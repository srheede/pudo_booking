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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { LocalShipping, Send } from "@mui/icons-material";
import {
  customerService,
  bookingService,
  senderService,
} from "../firebase/services";
import {
  clearLockersCache,
  isCacheValid,
} from "../components/LockerAutocomplete.jsx";

const ipcRenderer = window.require
  ? window.require("electron").ipcRenderer
  : null;

const LOCKER_SIZES = [
  { value: "XS", label: "Extra Small (XS)", code: "L2LXS - ECO" },
  { value: "S", label: "Small (S)", code: "L2LS - ECO" },
  { value: "M", label: "Medium (M)", code: "L2LM - ECO" },
  { value: "L", label: "Large (L)", code: "L2LL - ECO" },
];

const BookingsPage = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [defaultSize, setDefaultSize] = useState("XS");
  const [customerSizes, setCustomerSizes] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customersData, senderData] = await Promise.all([
        customerService.getAll(),
        senderService.get(),
      ]);
      setCustomers(customersData);
      setSender(senderData);
      await loadLockersData();
    } catch (error) {
      console.error("Error loading data:", error);
      showSnackbar("Error loading data", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadLockersData = async () => {
    try {
      let terminals;

      if (!ipcRenderer) {
        // Browser mode: make direct API call
        if (!process.env.PUDO_API_KEY) {
          console.warn("PUDO_API_KEY not available in browser mode");
          return;
        }

        const response = await fetch(
          "https://api-pudo.co.za/api/v1/lockers-data",
          {
            method: "GET",
            headers: {
              Authorization: process.env.PUDO_API_KEY,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        terminals = await response.json();
      } else {
        // Electron mode: use IPC
        terminals = await ipcRenderer.invoke("get-all-terminals");
      }

      if (terminals && Array.isArray(terminals)) {
        const lockersMapping = {};
        terminals.forEach((locker) => {
          lockersMapping[locker.code] = locker.name;
        });
        setLockersMap(lockersMapping);
      }
    } catch (error) {
      console.error("Error loading lockers data:", error);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSelectionChange = (newSelection) => {
    setSelectedCustomers(newSelection);

    // Initialize sizes for newly selected customers
    const newSizes = { ...customerSizes };
    newSelection.forEach((customerId) => {
      if (!newSizes[customerId]) {
        newSizes[customerId] = defaultSize;
      }
    });
    setCustomerSizes(newSizes);
  };

  const handleSizeChange = (customerId, size) => {
    setCustomerSizes((prev) => ({
      ...prev,
      [customerId]: size,
    }));
  };

  const handleCreateBookings = () => {
    if (selectedCustomers.length === 0) {
      showSnackbar("Please select at least one customer", "warning");
      return;
    }

    if (!sender) {
      showSnackbar("Please configure sender details first", "error");
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
          const sizeConfig = LOCKER_SIZES.find((s) => s.value === size);

          // Build collection address
          const collectionAddress =
            sender.deliveryType === "locker"
              ? { terminal_id: sender.lockerId }
              : {
                  line1: sender.address.street,
                  line2: sender.address.suburb || "",
                  city: sender.address.city,
                  province: sender.address.province,
                  postal_code: sender.address.postalCode || "",
                };

          // Build delivery address
          const deliveryAddress =
            customer.deliveryType === "locker"
              ? { terminal_id: customer.lockerId }
              : {
                  line1: customer.address.street,
                  line2: customer.address.suburb || "",
                  city: customer.address.city,
                  province: customer.address.province,
                  postal_code: customer.address.postalCode || "",
                };

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
            service_level_code: sizeConfig.code,
          };

          console.log("Creating shipment with payload:", payload);

          let shipmentResult;
          if (ipcRenderer) {
            shipmentResult = await ipcRenderer.invoke(
              "create-shipment",
              payload
            );
          } else {
            // Mock response for browser environment
            shipmentResult = {
              shipment_id: `MOCK_${Date.now()}`,
              id: `MOCK_${Date.now()}`,
              status: "created",
            };
          }

          // Save booking to Firebase
          await bookingService.add({
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
      renderCell: (params) => (
        <Chip
          label={params.value === "locker" ? "Locker" : "Address"}
          color={params.value === "locker" ? "primary" : "secondary"}
          size="small"
        />
      ),
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
        } else {
          const address = customer.address;
          if (address) {
            return `${address.street || ""}, ${address.city || ""}, ${
              address.province || ""
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

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
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

      {!sender && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please configure your sender details before creating bookings.
        </Alert>
      )}

      <Paper sx={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={customers}
          columns={columns}
          loading={loading}
          checkboxSelection
          rowSelectionModel={selectedCustomers}
          onRowSelectionModelChange={handleSelectionChange}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
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
