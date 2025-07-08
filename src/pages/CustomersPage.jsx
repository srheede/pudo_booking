import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Add, Edit, Delete } from "@mui/icons-material";
import config from "../../config.json";

// Helper function to get Authorization header
const getAuthHeaders = () => ({
  Authorization: `Bearer ${config.PUDO_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});
import { customerService } from "../firebase/services";
import CustomerForm from "../components/CustomerForm.jsx";
import LockerAutocomplete, {
  clearLockersCache,
  isCacheValid,
} from "../components/LockerAutocomplete.jsx";

const ipcRenderer = window.require
  ? window.require("electron").ipcRenderer
  : null;

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [lockersMap, setLockersMap] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const customersData = await customerService.getAll();
      setCustomers(customersData);
      await loadLockersData();
    } catch (error) {
      console.error("Error loading customers:", error);
      showSnackbar("Error loading customers", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadLockersData = async () => {
    try {
      let terminals;

      if (!ipcRenderer) {
        // Browser mode: make direct API call
        const response = await fetch(`${config.API_BASE_URL}/lockers-data`, {
          method: "GET",
          headers: getAuthHeaders(),
        });

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

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setFormOpen(true);
  };

  const handleEditCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormOpen(true);
  };

  const handleDeleteCustomer = (customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const handleSaveCustomer = async (customerData) => {
    try {
      if (selectedCustomer) {
        await customerService.update(selectedCustomer.id, customerData);
        showSnackbar("Customer updated successfully");
      } else {
        await customerService.add(customerData);
        showSnackbar("Customer added successfully");
      }
      await loadCustomers();
    } catch (error) {
      console.error("Error saving customer:", error);
      showSnackbar("Error saving customer", "error");
    }
  };

  const confirmDelete = async () => {
    try {
      await customerService.delete(customerToDelete.id);
      showSnackbar("Customer deleted successfully");
      await loadCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
      showSnackbar("Error deleting customer", "error");
    } finally {
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  const columns = [
    {
      field: "name",
      headerName: "Name",
      width: 200,
      flex: 1,
    },
    {
      field: "email",
      headerName: "Email",
      width: 250,
      flex: 1,
    },
    {
      field: "mobile",
      headerName: "Mobile",
      width: 150,
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
      field: "actions",
      headerName: "Actions",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleEditCustomer(params.row)}
            color="primary"
          >
            <Edit />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeleteCustomer(params.row)}
            color="error"
          >
            <Delete />
          </IconButton>
        </Box>
      ),
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
          Customers
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddCustomer}
        >
          Add Customer
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={customers}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveCustomer}
        customer={selectedCustomer}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete customer "{customerToDelete?.name}"?
          This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
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

export default CustomersPage;
