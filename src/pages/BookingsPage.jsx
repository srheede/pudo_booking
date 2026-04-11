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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { LocalShipping, Send, Search } from "@mui/icons-material";
import {
  customerService,
  bookingService,
  senderService,
} from "../firebase/services";
import { useAuth } from "../contexts/AuthContext";
import {
  clearLockersCache,
  isCacheValid,
} from "../components/LockerAutocomplete.jsx";
import config from "../../config.json";

// Helper function to get Authorization header
const getAuthHeaders = () => ({
  Authorization: `Bearer ${config.PUDO_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

const ipcRenderer = window.require
  ? window.require("electron").ipcRenderer
  : null;

const LOCKER_SIZES = [
  { value: "XS", label: "Extra Small (XS)" },
  { value: "S", label: "Small (S)" },
  { value: "M", label: "Medium (M)" },
  { value: "L", label: "Large (L)" },
];

// Derives the correct PUDO service level code from both the sender (collection)
// type and the customer (delivery) type.
// Pattern: {C}2{D}{SIZE} - ECO  where C = L(ocker)|K(iosk), D = L|K|D(oor)
const getServiceCode = (senderType, customerType, size) => {
  const from = senderType === "kiosk" ? "K" : "L";
  const to =
    customerType === "kiosk"
      ? "K"
      : customerType === "locker"
      ? "L"
      : "D";
  return `${from}2${to}${size} - ECO`;
};

// Maps full province names stored by older records to abbreviated zone codes.
// New records from Google Places already store the short_name abbreviation.
const PROVINCE_TO_ZONE = {
  Gauteng: "GP",
  "Western Cape": "WC",
  "Eastern Cape": "EC",
  "KwaZulu-Natal": "KZN",
  "Free State": "FS",
  Limpopo: "LP",
  Mpumalanga: "MP",
  "North West": "NW",
  "Northern Cape": "NC",
};

const toZoneCode = (province) => {
  if (!province) return "";
  return PROVINCE_TO_ZONE[province] || province;
};

const BookingsPage = () => {
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
      let terminals;

      if (!ipcRenderer) {
        const response = await fetch(`${config.API_BASE_URL}/lockers-data`, {
          method: "GET",
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        terminals = await response.json();
      } else {
        terminals = await ipcRenderer.invoke("get-all-terminals");
      }

      if (terminals && Array.isArray(terminals)) {
        const lockersMapping = {};
        const kiosksMapping = {};
        terminals.forEach((terminal) => {
          if (terminal.type?.id === 2) {
            lockersMapping[terminal.code] = terminal.name;
          } else if (terminal.type?.id === 1) {
            kiosksMapping[terminal.code] = terminal.name;
          }
        });
        setLockersMap(lockersMapping);
        setKiosksMap(kiosksMapping);
      }
    } catch (error) {
      console.error("Error loading terminals data:", error);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSelectionChange = (newSelection) => {
    // visibleCustomers is derived from filteredCustomers + paginationModel below,
    // but we can recompute it here to keep this handler self-contained.
    const pageStart = paginationModel.page * paginationModel.pageSize;
    const pageIds = new Set(
      filteredCustomers.slice(pageStart, pageStart + paginationModel.pageSize).map((c) => c.id)
    );
    const prevSet = new Set(selectedCustomers);

    // If any newly-added IDs are from outside the current page the DataGrid's
    // built-in "select all rows" header was clicked → clip to page only.
    const offPageAdded = newSelection.some((id) => !prevSet.has(id) && !pageIds.has(id));

    let finalSelection;
    if (offPageAdded) {
      // Select all header clicked: merge current page into existing selection
      finalSelection = [...new Set([...selectedCustomers, ...pageIds])];
    } else if (newSelection.length === 0 && selectedCustomers.length > 0) {
      // Deselect all header clicked.
      // If everything was selected (via "select all" banner), clear the whole selection.
      // Otherwise only remove the current page's items to preserve other pages.
      finalSelection = allFilteredSelected
        ? []
        : selectedCustomers.filter((id) => !pageIds.has(id));
    } else {
      finalSelection = newSelection;
    }

    setSelectedCustomers(finalSelection);
    setAllFilteredSelected(false);

    // Initialize sizes for newly selected customers
    const newSizes = { ...customerSizes };
    finalSelection.forEach((customerId) => {
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

          const buildAddressObject = (address) => ({
            street_address: address.street,
            local_area: address.suburb || "",
            suburb: address.suburb || "",
            city: address.city,
            zone: toZoneCode(address.province),
            code: address.postalCode || "",
            country: "South Africa",
            entered_address: address.fullAddress || `${address.street}, ${address.suburb || ""}, ${address.city}, ${address.postalCode || ""}, South Africa`.replace(/,\s*,/g, ","),
            type: "residential",
            ...(address.lat != null && { lat: String(address.lat) }),
            ...(address.lng != null && { lng: String(address.lng) }),
          });

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

          let shipmentResult;
          if (ipcRenderer) {
            shipmentResult = await ipcRenderer.invoke(
              "create-shipment",
              payload
            );
          } else {
            // Browser mode: make direct API call
            const response = await fetch(`${config.API_BASE_URL}/shipments`, {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            shipmentResult = await response.json();
          }

          // Save booking to Firebase
          await bookingService.add(user?.uid, {
            customerId: customer.id,
            customerName: customer.name,
            lockerSize: size,
            pudoRef: shipmentResult.shipment_id || shipmentResult.id,
            status: "created",
            shipmentData: shipmentResult,
          });

          results.push({
            customer: customer.name,
            success: true,
            result: shipmentResult,
          });
        } catch (error) {
          console.error(`Error creating booking for ${customer.name}:`, error);
          results.push({
            customer: customer.name,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (successCount > 0 && failCount === 0) {
        showSnackbar(
          `Successfully created ${successCount} booking(s)`,
          "success"
        );
      } else if (successCount > 0 && failCount > 0) {
        showSnackbar(
          `Created ${successCount} booking(s), ${failCount} failed`,
          "warning"
        );
      } else {
        showSnackbar("All bookings failed to create", "error");
      }

      // Update monthly booking count
      setMonthlyBookingCount((prev) => prev + successCount);

      // Clear selections
      setSelectedCustomers([]);
      setCustomerSizes({});
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
        const type = params.value;
        const label = type === "locker" ? "Locker" : type === "kiosk" ? "Kiosk" : "Address";
        const color = type === "locker" ? "primary" : type === "kiosk" ? "warning" : "secondary";
        return <Chip label={label} color={color} size="small" />;
      },
    },
    {
      field: "deliveryLocation",
      headerName: "Delivery Location",
      width: 200,
      flex: 1,
      renderCell: (params) => {
        const customer = params.row;
        if (customer.deliveryType === "locker") {
          const lockerName = lockersMap[customer.lockerId];
          return lockerName
            ? `${customer.lockerId} - ${lockerName}`
            : customer.lockerId || "Not set";
        } else if (customer.deliveryType === "kiosk") {
          const kioskName = kiosksMap[customer.kioskId];
          return kioskName
            ? `${customer.kioskId} - ${kioskName}`
            : customer.kioskId || "Not set";
        } else {
          const address = customer.address;
          if (address) {
            return `${address.street || ""}, ${address.suburb || ""}, ${
              address.city || ""
            }`.replace(/^,\s*|,\s*$/g, "");
          }
          return "Not set";
        }
      },
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
        onChange={(e) => { setSearchQuery(e.target.value); setAllFilteredSelected(false); }}
        sx={{ mb: 2, width: 320 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

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
          rowSelectionModel={selectedCustomers}
          onRowSelectionModelChange={handleSelectionChange}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]}
        />
      </Paper>

      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, customers: [] })}
        maxWidth="sm"
        fullWidth
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
    </Box>
  );
};

export default BookingsPage;
