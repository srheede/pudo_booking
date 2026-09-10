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
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Fab,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Add, Edit, Delete, Search } from "@mui/icons-material";
import { customerService } from "../firebase/services";
import { useAuth } from "../contexts/AuthContext";
import { analytics } from "../firebase/analytics";
import { crashlytics } from "../firebase/crashlytics";
import CustomerForm from "../components/CustomerForm.jsx";
import {
  getAllTerminals,
  terminalsToMaps,
  formatDeliveryLocation,
  deliveryTypeChip,
} from "../api/pudoClient";

const CustomersPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user, tierLimits, subscriptionTier, pudoApiKey, publicMode } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [lockersMap, setLockersMap] = useState({});
  const [kiosksMap, setKiosksMap] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // In PUBLIC_MODE, wait until the API key has been loaded from the user profile.
    if (publicMode && !pudoApiKey) return;
    loadCustomers();
  }, [pudoApiKey]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const customersData = await customerService.getAll(user?.uid);
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
      const terminals = await getAllTerminals();
      const maps = terminalsToMaps(terminals);
      setLockersMap(maps.lockersMap);
      setKiosksMap(maps.kiosksMap);
    } catch (error) {
      console.error("Error loading lockers data:", error);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const atCustomerLimit =
    tierLimits?.maxCustomers !== null &&
    customers.length >= (tierLimits?.maxCustomers ?? Infinity);

  const handleAddCustomer = () => {
    if (atCustomerLimit) {
      showSnackbar(
        `Your ${subscriptionTier} plan allows up to ${tierLimits.maxCustomers} customers. Upgrade your plan to add more.`,
        "warning"
      );
      return;
    }
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
        await customerService.update(user?.uid, selectedCustomer.id, customerData);
        analytics.event("customer_updated");
        showSnackbar("Customer updated successfully");
      } else {
        await customerService.add(user?.uid, customerData);
        analytics.event("customer_created");
        showSnackbar("Customer added successfully");
      }
      await loadCustomers();
    } catch (error) {
      console.error("Error saving customer:", error);
      crashlytics.recordError(error, { source: "save-customer" });
      showSnackbar("Error saving customer", "error");
    }
  };

  const confirmDelete = async () => {
    try {
      await customerService.delete(user?.uid, customerToDelete.id);
      analytics.event("customer_deleted");
      showSnackbar("Customer deleted successfully");
      await loadCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
      crashlytics.recordError(error, { source: "delete-customer" });
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

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const nameMatch = c.name?.toLowerCase().includes(q);
    const emailMatch = c.email?.toLowerCase().includes(q);
    const mobileMatch = c.mobile?.toLowerCase().includes(q);
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
    return (
      nameMatch ||
      emailMatch ||
      mobileMatch ||
      typeMatch ||
      lockerMatch ||
      kioskMatch ||
      addressMatch
    );
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: { xs: 10, md: 3 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant={isMobile ? "h5" : "h4"} component="h1">
          Customers
        </Typography>
        {!isMobile && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddCustomer}
            disabled={atCustomerLimit}
          >
            Add Customer
          </Button>
        )}
      </Box>

      {atCustomerLimit && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have reached the {tierLimits.maxCustomers}-customer limit for your{" "}
          <strong style={{ textTransform: "capitalize" }}>{subscriptionTier}</strong> plan.
          Upgrade your subscription to add more customers.
        </Alert>
      )}

      <TextField
        size="small"
        placeholder="Search customers…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2, width: { xs: "100%", md: 320 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {isMobile ? (
        <Paper>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : filteredCustomers.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography color="text.secondary">No customers found</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredCustomers.map((customer) => {
                const chip = deliveryTypeChip(customer.deliveryType);
                return (
                  <ListItem
                    key={customer.id}
                    divider
                    onClick={() => handleEditCustomer(customer)}
                    sx={{ pr: 10 }}
                  >
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
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCustomer(customer);
                        }}
                        color="primary"
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomer(customer);
                        }}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Paper>
      ) : (
        <Paper sx={{ height: 600, width: "100%" }}>
          <DataGrid
            rows={filteredCustomers}
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
      )}

      {isMobile && (
        <Fab
          color="primary"
          aria-label="add customer"
          onClick={handleAddCustomer}
          disabled={atCustomerLimit}
          sx={{
            position: "fixed",
            right: 16,
            bottom: "calc(72px + env(safe-area-inset-bottom))",
          }}
        >
          <Add />
        </Fab>
      )}

      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveCustomer}
        customer={selectedCustomer}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        fullScreen={isMobile}
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
