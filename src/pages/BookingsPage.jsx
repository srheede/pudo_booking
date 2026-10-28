import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  LinearProgress,
  TextField,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Send, Search } from "@mui/icons-material";
import {
  customerService,
  bookingService,
  senderService,
} from "../firebase/services";
import { crashlytics } from "../firebase/crashlytics";
import { analytics } from "../firebase/analytics";
import { useAuth } from "../contexts/AuthContext";
import {
  getAllTerminals,
  getRates,
  createShipment,
  terminalsToMaps,
  formatDeliveryLocation,
  deliveryTypeChip,
} from "../api/pudoClient";
import {
  explainBookingFailure,
  isBalanceError,
} from "../api/bookingErrors";
import { notifyEcommerceBookingCreated } from "../api/notifyEcommerceBooking";

const LOCKER_SIZES = [
  { value: "XS", label: "Extra Small (XS)" },
  { value: "S", label: "Small (S)" },
  { value: "M", label: "Medium (M)" },
  { value: "L", label: "Large (L)" },
];

// Derives the correct PUDO service level code from both the sender (collection)
// type and the customer (delivery) type.
// Pattern: {C}2{D}{SIZE} - ECO  where C/D = L(ocker)|K(iosk)|D(oor)
const toServiceLetter = (type) =>
  type === "kiosk" ? "K" : type === "address" ? "D" : "L";

const getServiceCode = (senderType, customerType, size) =>
  `${toServiceLetter(senderType)}2${toServiceLetter(customerType)}${size} - ECO`;

// Maps full province names stored by older/manual records to PUDO zone codes.
// Google Places stores short_name abbreviations (e.g. "GP").
const PROVINCE_TO_ZONE = {
  gauteng: "GP",
  "western cape": "WC",
  "eastern cape": "EC",
  "kwazulu-natal": "KZN",
  "free state": "FS",
  limpopo: "LP",
  mpumalanga: "MP",
  "north west": "NW",
  "northern cape": "NC",
  gp: "GP",
  wc: "WC",
  ec: "EC",
  kzn: "KZN",
  fs: "FS",
  lp: "LP",
  mp: "MP",
  nw: "NW",
  nc: "NC",
};

const toZoneCode = (province) => {
  if (!province) return "";
  const key = String(province).trim().toLowerCase();
  return PROVINCE_TO_ZONE[key] || String(province).trim().toUpperCase();
};

const validateDoorAddress = (address, label) => {
  if (!address?.street?.trim()) return `${label}: street address is missing`;
  if (!address?.city?.trim()) return `${label}: city is missing`;
  if (!toZoneCode(address?.province)) return `${label}: province/zone is missing`;
  return null;
};

const hasCoords = (address) => {
  if (address?.lat == null || address?.lng == null) return false;
  if (address.lat === "" || address.lng === "") return false;
  return Number.isFinite(Number(address.lat)) && Number.isFinite(Number(address.lng));
};

// PUDO cannot geocode door addresses when local_area is blank (common on
// imported customers that have a city but no suburb). Fall back to city.
const doorLocalArea = (address) =>
  String(address?.suburb || address?.city || "").trim();

const buildAddressObject = (address) => {
  const localArea = doorLocalArea(address);
  return {
    street_address: address.street,
    local_area: localArea,
    suburb: localArea,
    city: address.city,
    zone: toZoneCode(address.province),
    code: address.postalCode || "",
    country: "South Africa",
    entered_address:
      address.fullAddress ||
      `${address.street}, ${localArea}, ${address.city}, ${address.postalCode || ""}, South Africa`
        .replace(/,\s*,/g, ",")
        .replace(/^,\s*|,\s*$/g, ""),
    type: "residential",
    ...(hasCoords(address)
      ? { lat: String(address.lat), lng: String(address.lng) }
      : {}),
  };
};

const BookingsPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user, tierLimits, subscriptionTier, pudoApiKey, publicMode, userProfile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [defaultSize, setDefaultSize] = useState("XS");
  const [customerSizes, setCustomerSizes] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [monthlyBookingCount, setMonthlyBookingCount] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    customers: [],
  });
  const [sender, setSender] = useState(null);
  const [lockersMap, setLockersMap] = useState({});
  const [kiosksMap, setKiosksMap] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileStep, setMobileStep] = useState(0);

  useEffect(() => {
    // In PUBLIC_MODE, wait until the API key has been loaded from the user profile.
    if (publicMode && !pudoApiKey) return;
    loadData();
  }, [pudoApiKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customersData, senderData, monthlyCount] = await Promise.all([
        customerService.getAll(user?.uid),
        senderService.get(user?.uid),
        bookingService.getMonthlyCount(
          user?.uid,
          userProfile?.lastPaymentDate
            ? new Date(userProfile.lastPaymentDate.seconds * 1000)
            : null
        ),
      ]);
      setCustomers(customersData);
      setSender(senderData);
      setMonthlyBookingCount(monthlyCount);
      await loadTerminalsData();
    } catch (error) {
      console.error("Error loading data:", error);
      showSnackbar("Error loading data", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadTerminalsData = async () => {
    try {
      const terminals = await getAllTerminals();
      const maps = terminalsToMaps(terminals);
      setLockersMap(maps.lockersMap);
      setKiosksMap(maps.kiosksMap);
    } catch (error) {
      console.error("Error loading terminals data:", error);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSelectionChange = (newSelection) => {
    setSelectedCustomers(newSelection);
    setAllFilteredSelected(false);

    // Initialize sizes for newly selected customers
    const newSizes = { ...customerSizes };
    newSelection.forEach((customerId) => {
      if (!newSizes[customerId]) {
        newSizes[customerId] = defaultSize;
      }
    });
    setCustomerSizes(newSizes);
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredCustomers.map((c) => c.id);
    const newSizes = { ...customerSizes };
    allIds.forEach((id) => {
      if (!newSizes[id]) newSizes[id] = defaultSize;
    });
    setCustomerSizes(newSizes);
    setSelectedCustomers(allIds);
    setAllFilteredSelected(true);
  };

  const handleSizeChange = (customerId, size) => {
    setCustomerSizes((prev) => ({
      ...prev,
      [customerId]: size,
    }));
  };

  const maxMonthlyBookings = tierLimits?.maxMonthlyBookings ?? null;
  const remainingBookings = maxMonthlyBookings !== null
    ? Math.max(0, maxMonthlyBookings - monthlyBookingCount)
    : null;
  const wouldExceedLimit = maxMonthlyBookings !== null &&
    monthlyBookingCount + selectedCustomers.length > maxMonthlyBookings;

  const handleCreateBookings = () => {
    if (selectedCustomers.length === 0) {
      showSnackbar("Please select at least one customer", "warning");
      return;
    }

    if (!sender) {
      showSnackbar("Please configure sender details first", "error");
      return;
    }

    if (wouldExceedLimit) {
      showSnackbar(
        `This would exceed your booking limit (${maxMonthlyBookings}/month on ${subscriptionTier} plan). You have ${remainingBookings} booking${remainingBookings === 1 ? "" : "s"} remaining this billing period.`,
        "warning"
      );
      return;
    }

    const selectedCustomerData = customers.filter((c) =>
      selectedCustomers.includes(c.id)
    );
    setConfirmDialog({ open: true, customers: selectedCustomerData });
  };

  const confirmCreateBookings = async () => {
    try {
      setCreating(true);
      setConfirmDialog({ open: false, customers: [] });

      const selectedCustomerData = customers.filter((c) =>
        selectedCustomers.includes(c.id)
      );
      const results = [];

      for (const customer of selectedCustomerData) {
        try {
          const size = customerSizes[customer.id] || defaultSize;

          // Door/address destinations need a complete zone-capable address.
          if (customer.deliveryType === "address") {
            const doorError = validateDoorAddress(
              customer.address,
              customer.name
            );
            if (doorError) {
              throw new Error(doorError);
            }
          }
          if (sender.deliveryType === "address") {
            const senderError = validateDoorAddress(sender.address, "Sender");
            if (senderError) {
              throw new Error(senderError);
            }
          }

          // Build collection address
          const collectionAddress =
            sender.deliveryType === "locker"
              ? { terminal_id: sender.lockerId }
              : sender.deliveryType === "kiosk"
              ? { terminal_id: sender.kioskId }
              : buildAddressObject(sender.address);

          // Build delivery address
          const deliveryAddress =
            customer.deliveryType === "locker"
              ? { terminal_id: customer.lockerId }
              : customer.deliveryType === "kiosk"
              ? { terminal_id: customer.kioskId }
              : buildAddressObject(customer.address);

          const serviceCode = getServiceCode(
            sender.deliveryType,
            customer.deliveryType,
            size
          );

          const payload = {
            collection_address: collectionAddress,
            special_instructions_collection: "",
            collection_contact: {
              name: sender.name,
              email: sender.email,
              mobile_number: sender.mobile,
            },
            delivery_address: deliveryAddress,
            special_instructions_delivery: "",
            delivery_contact: {
              name: customer.name,
              email: customer.email,
              mobile_number: customer.mobile,
            },
            service_level_code: serviceCode,
          };

          // Quote first so a low PUDO balance is explained with the price,
          // instead of looking like another Windows door-booking bug.
          try {
            const quote = await getRates({
              collection_address: collectionAddress,
              delivery_address: deliveryAddress,
            });
            const match = Array.isArray(quote?.rates)
              ? quote.rates.find((rate) => rate?.service_level?.code === serviceCode)
              : null;
            if (match?.can_book?.status === false) {
              const balanceError = new Error(
                match.can_book.message || "Cannot process shipment."
              );
              balanceError.pudoType = match.can_book.type;
              balanceError.rate = match.rate;
              balanceError.serviceCode = serviceCode;
              throw balanceError;
            }
          } catch (rateError) {
            if (isBalanceError(rateError.message) || rateError.pudoType) {
              throw rateError;
            }
            console.warn("Rate check failed, continuing to create shipment", rateError);
          }

          const shipmentResult = await createShipment(payload);

          // Save booking to Firebase
          await bookingService.add(user?.uid, {
            customerId: customer.id,
            customerName: customer.name,
            customerEmail: customer.email || "",
            lockerSize: size,
            pudoRef: shipmentResult.shipment_id || shipmentResult.id,
            status: "created",
            shipmentData: shipmentResult,
          });
          await notifyEcommerceBookingCreated({
            customerId: customer.id,
            customerEmail: customer.email || "",
            pudoRef: shipmentResult.shipment_id || shipmentResult.id,
            shipmentData: shipmentResult,
          });
          analytics.event("booking_created", {
            deliveryType: customer.deliveryType || "",
            lockerSize: size,
          });

          results.push({
            customer: customer.name,
            success: true,
            result: shipmentResult,
          });
        } catch (error) {
          console.error(`Error creating booking for ${customer.name}:`, error);
          const friendly = explainBookingFailure(error);
          crashlytics.recordError(error, {
            source: "create-booking",
            customerId: customer.id,
            customerName: customer.name,
            deliveryType: customer.deliveryType,
            senderType: sender?.deliveryType,
            serviceCode: error.serviceCode || null,
            rate: error.rate || null,
            pudoType: error.pudoType || null,
            hasLat: customer.address?.lat != null,
            hasLng: customer.address?.lng != null,
            zone: customer.address?.province
              ? toZoneCode(customer.address.province)
              : null,
          });
          results.push({
            customer: customer.name,
            success: false,
            error: friendly,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      const firstFailure = results.find((r) => !r.success);

      if (successCount > 0 && failCount === 0) {
        showSnackbar(
          `Successfully created ${successCount} booking(s)`,
          "success"
        );
      } else if (successCount > 0 && failCount > 0) {
        showSnackbar(
          `Created ${successCount} booking(s), ${failCount} failed${
            firstFailure?.error ? `: ${firstFailure.error}` : ""
          }`,
          "warning"
        );
      } else {
        showSnackbar(
          firstFailure?.error
            ? `Booking failed: ${firstFailure.error}`
            : "All bookings failed to create",
          "error"
        );
      }

      // Update monthly booking count
      setMonthlyBookingCount((prev) => prev + successCount);

      // Clear selections
      setSelectedCustomers([]);
      setCustomerSizes({});
      setMobileStep(0);
    } catch (error) {
      console.error("Error creating bookings:", error);
      showSnackbar("Error creating bookings", "error");
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      field: "name",
      headerName: "Customer Name",
      width: 200,
      flex: 1,
    },
    {
      field: "email",
      headerName: "Email",
      width: 200,
      flex: 1,
    },
    {
      field: "deliveryType",
      headerName: "Delivery Type",
      width: 120,
      renderCell: (params) => {
        const chip = deliveryTypeChip(params.value);
        return <Chip label={chip.label} color={chip.color} size="small" />;
      },
    },
    {
      field: "deliveryLocation",
      headerName: "Delivery Location",
      width: 200,
      flex: 1,
      renderCell: (params) =>
        formatDeliveryLocation(params.row, lockersMap, kiosksMap),
    },
    {
      field: "packageSize",
      headerName: "Package Size",
      width: 150,
      renderCell: (params) => {
        const customerId = params.row.id;
        const currentSize = customerSizes[customerId] || defaultSize;

        return (
          <FormControl size="small" fullWidth>
            <Select
              value={currentSize}
              onChange={(e) => handleSizeChange(customerId, e.target.value)}
              disabled={!selectedCustomers.includes(customerId)}
            >
              {LOCKER_SIZES.map((size) => (
                <MenuItem key={size.value} value={size.value}>
                  {size.value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      },
    },
  ];

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const nameMatch = c.name?.toLowerCase().includes(q);
    const emailMatch = c.email?.toLowerCase().includes(q);
    const typeMatch = c.deliveryType?.toLowerCase().includes(q);
    const lockerMatch =
      c.deliveryType === "locker" &&
      (c.lockerId?.toLowerCase().includes(q) ||
        lockersMap[c.lockerId]?.toLowerCase().includes(q));
    const kioskMatch =
      c.deliveryType === "kiosk" &&
      (c.kioskId?.toLowerCase().includes(q) ||
        kiosksMap[c.kioskId]?.toLowerCase().includes(q));
    const addressMatch =
      c.deliveryType === "address" &&
      (c.address?.street?.toLowerCase().includes(q) ||
        c.address?.suburb?.toLowerCase().includes(q) ||
        c.address?.city?.toLowerCase().includes(q));
    return nameMatch || emailMatch || typeMatch || lockerMatch || kioskMatch || addressMatch;
  });

  const visibleCustomers = filteredCustomers.slice(
    paginationModel.page * paginationModel.pageSize,
    (paginationModel.page + 1) * paginationModel.pageSize
  );
  const allPageSelected =
    visibleCustomers.length > 0 &&
    visibleCustomers.every((c) => selectedCustomers.includes(c.id));
  const showSelectAllBanner =
    allPageSelected && !allFilteredSelected && filteredCustomers.length > visibleCustomers.length;

  const toggleCustomer = (customerId) => {
    if (selectedCustomers.includes(customerId)) {
      handleSelectionChange(selectedCustomers.filter((id) => id !== customerId));
    } else {
      handleSelectionChange([...selectedCustomers, customerId]);
    }
  };

  const selectedCustomerData = customers.filter((c) =>
    selectedCustomers.includes(c.id)
  );

  const alerts = (
    <>
      {!sender && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please configure your sender details before creating bookings.
        </Alert>
      )}

      {maxMonthlyBookings !== null && (
        <Alert
          severity={monthlyBookingCount >= maxMonthlyBookings ? "error" : "info"}
          sx={{ mb: 2 }}
        >
          {monthlyBookingCount >= maxMonthlyBookings
            ? `You have used all ${maxMonthlyBookings} bookings for this billing period on your ${subscriptionTier} plan. Upgrade your plan to continue booking.`
            : `Bookings this billing period: ${monthlyBookingCount} / ${maxMonthlyBookings} used (${remainingBookings} remaining).`}
        </Alert>
      )}
    </>
  );

  const confirmAndSnackbar = (
    <>
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, customers: [] })}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Confirm Bookings</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            You are about to create bookings for the following customers:
          </Typography>
          {confirmDialog.customers.map((customer) => (
            <Box
              key={customer.id}
              sx={{ display: "flex", justifyContent: "space-between", py: 1 }}
            >
              <Typography>{customer.name}</Typography>
              <Chip
                label={customerSizes[customer.id] || defaultSize}
                size="small"
                color="primary"
              />
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog({ open: false, customers: [] })}
          >
            Cancel
          </Button>
          <Button onClick={confirmCreateBookings} variant="contained">
            Confirm & Create
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );

  if (isMobile) {
    return (
      <Box sx={{ p: 2, pb: 10 }}>
        <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
          Create Bookings
        </Typography>
        {alerts}
        <Stepper activeStep={mobileStep} alternativeLabel sx={{ mb: 2 }}>
          <Step>
            <StepLabel>Select</StepLabel>
          </Step>
          <Step>
            <StepLabel>Sizes</StepLabel>
          </Step>
          <Step>
            <StepLabel>Confirm</StepLabel>
          </Step>
        </Stepper>

        {mobileStep === 0 && (
          <>
            <TextField
              size="small"
              placeholder="Search customers…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setAllFilteredSelected(false);
              }}
              fullWidth
              sx={{ mb: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Paper>
              <List disablePadding>
                {filteredCustomers.map((customer) => {
                  const chip = deliveryTypeChip(customer.deliveryType);
                  return (
                    <ListItem key={customer.id} disablePadding divider>
                      <ListItemButton onClick={() => toggleCustomer(customer.id)}>
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={selectedCustomers.includes(customer.id)}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={customer.name}
                          secondary={
                            <>
                              <Chip
                                label={chip.label}
                                color={chip.color}
                                size="small"
                                sx={{ mr: 1, my: 0.5 }}
                              />
                              {formatDeliveryLocation(customer, lockersMap, kiosksMap)}
                            </>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              disabled={selectedCustomers.length === 0}
              onClick={() => setMobileStep(1)}
            >
              Next ({selectedCustomers.length} selected)
            </Button>
          </>
        )}

        {mobileStep === 1 && (
          <>
            <FormControl size="small" fullWidth sx={{ mb: 2 }}>
              <InputLabel>Default Size</InputLabel>
              <Select
                value={defaultSize}
                onChange={(e) => {
                  const size = e.target.value;
                  setDefaultSize(size);
                  const next = { ...customerSizes };
                  selectedCustomers.forEach((id) => {
                    next[id] = size;
                  });
                  setCustomerSizes(next);
                }}
                label="Default Size"
              >
                {LOCKER_SIZES.map((size) => (
                  <MenuItem key={size.value} value={size.value}>
                    {size.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Paper>
              <List disablePadding>
                {selectedCustomerData.map((customer) => (
                  <ListItem key={customer.id} divider>
                    <ListItemText primary={customer.name} />
                    <FormControl size="small" sx={{ minWidth: 90 }}>
                      <Select
                        value={customerSizes[customer.id] || defaultSize}
                        onChange={(e) => handleSizeChange(customer.id, e.target.value)}
                      >
                        {LOCKER_SIZES.map((size) => (
                          <MenuItem key={size.value} value={size.value}>
                            {size.value}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </ListItem>
                ))}
              </List>
            </Paper>
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button fullWidth onClick={() => setMobileStep(0)}>
                Back
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={() => setMobileStep(2)}
              >
                Next
              </Button>
            </Box>
          </>
        )}

        {mobileStep === 2 && (
          <>
            <Paper sx={{ p: 2, mb: 2 }}>
              {selectedCustomerData.map((customer) => (
                <Box
                  key={customer.id}
                  sx={{ display: "flex", justifyContent: "space-between", py: 1 }}
                >
                  <Typography>{customer.name}</Typography>
                  <Chip
                    label={customerSizes[customer.id] || defaultSize}
                    size="small"
                    color="primary"
                  />
                </Box>
              ))}
            </Paper>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button fullWidth onClick={() => setMobileStep(1)} disabled={creating}>
                Back
              </Button>
              <Button
                variant="contained"
                fullWidth
                startIcon={creating ? null : <Send />}
                onClick={handleCreateBookings}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </Box>
          </>
        )}

        {confirmAndSnackbar}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h4" component="h1">
          Create Bookings
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Default Size</InputLabel>
            <Select
              value={defaultSize}
              onChange={(e) => setDefaultSize(e.target.value)}
              label="Default Size"
            >
              {LOCKER_SIZES.map((size) => (
                <MenuItem key={size.value} value={size.value}>
                  {size.value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={creating ? <LinearProgress /> : <Send />}
            onClick={handleCreateBookings}
            disabled={selectedCustomers.length === 0 || creating}
          >
            {creating
              ? "Creating..."
              : `Create Bookings (${selectedCustomers.length})`}
          </Button>
        </Box>
      </Box>

      <TextField
        size="small"
        placeholder="Search customers…"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setAllFilteredSelected(false);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
        }}
        sx={{ mb: 2, width: 320 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {alerts}

      {showSelectAllBanner && (
        <Alert
          severity="info"
          sx={{ mb: 1 }}
          action={
            <Button size="small" color="inherit" onClick={handleSelectAllFiltered}>
              Select all {filteredCustomers.length} items
            </Button>
          }
        >
          All {visibleCustomers.length} items on this page are selected.
        </Alert>
      )}
      {allFilteredSelected && (
        <Alert
          severity="info"
          sx={{ mb: 1 }}
          action={
            <Button
              size="small"
              color="inherit"
              onClick={() => { setSelectedCustomers([]); setAllFilteredSelected(false); }}
            >
              Clear selection
            </Button>
          }
        >
          All {filteredCustomers.length} items are selected.
        </Alert>
      )}

      <Paper sx={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={filteredCustomers}
          columns={columns}
          loading={loading}
          checkboxSelection
          keepNonExistentRowsSelected
          rowSelectionModel={selectedCustomers}
          onRowSelectionModelChange={handleSelectionChange}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]}
        />
      </Paper>

      {confirmAndSnackbar}
    </Box>
  );
};

export default BookingsPage;
