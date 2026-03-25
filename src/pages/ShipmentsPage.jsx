import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Divider,
  Grid,
  TextField,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Visibility,
  Edit,
  Delete,
  Refresh,
  LocalShipping,
  Person,
  Place,
  Phone,
  Email,
} from "@mui/icons-material";
import { bookingService } from "../firebase/services";
import config from "../../config.json";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${config.PUDO_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

const ipcRenderer = window.require
  ? window.require("electron").ipcRenderer
  : null;

const STATUS_CONFIG = {
  created: { label: "Created", color: "info" },
  collected: { label: "Collected", color: "warning" },
  "in-transit": { label: "In Transit", color: "primary" },
  in_transit: { label: "In Transit", color: "primary" },
  delivered: { label: "Delivered", color: "success" },
  cancelled: { label: "Cancelled", color: "error" },
  canceled: { label: "Cancelled", color: "error" },
  failed: { label: "Failed", color: "error" },
  pending: { label: "Pending", color: "default" },
};

const LOCAL_STATUSES = [
  "created",
  "collected",
  "in-transit",
  "delivered",
  "cancelled",
  "failed",
];

const formatAddress = (addr) => {
  if (!addr) return "N/A";
  if (addr.terminal_id) return `Terminal ID: ${addr.terminal_id}`;
  return [addr.street_address, addr.local_area || addr.suburb, addr.city, addr.zone, addr.code]
    .filter(Boolean)
    .join(", ");
};

const formatDate = (timestamp) => {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusConfig = (status) =>
  STATUS_CONFIG[status?.toLowerCase?.()] || { label: status || "Unknown", color: "default" };

const ShipmentsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewDialog, setViewDialog] = useState({
    open: false,
    booking: null,
    apiData: null,
    apiLoading: false,
    apiError: null,
  });

  const [editDialog, setEditDialog] = useState({
    open: false,
    booking: null,
    saving: false,
  });
  const [editForm, setEditForm] = useState({
    status: "created",
    notes: "",
    specialInstructionsCollection: "",
    specialInstructionsDelivery: "",
  });

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    booking: null,
    deleting: false,
    action: null,
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await bookingService.getAll();
      setBookings(data);
    } catch (error) {
      console.error("Error loading bookings:", error);
      showSnackbar("Error loading shipments", "error");
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchShipmentFromAPI = async (pudoRef) => {
    if (!pudoRef) throw new Error("No shipment reference");
    if (ipcRenderer) {
      return await ipcRenderer.invoke("get-shipment", pudoRef);
    }
    const response = await fetch(`${config.API_BASE_URL}/shipments/${pudoRef}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  };

  const closeViewDialog = () =>
    setViewDialog({ open: false, booking: null, apiData: null, apiLoading: false, apiError: null });

  const handleView = async (booking) => {
    setViewDialog({ open: true, booking, apiData: null, apiLoading: true, apiError: null });
    try {
      const apiData = await fetchShipmentFromAPI(booking.pudoRef);
      setViewDialog((prev) => ({ ...prev, apiData, apiLoading: false }));
    } catch {
      setViewDialog((prev) => ({
        ...prev,
        apiLoading: false,
        apiError: "Could not fetch live data from PUDO API — showing stored data.",
      }));
    }
  };

  const handleRefreshAPIData = async () => {
    const { booking } = viewDialog;
    if (!booking) return;
    setViewDialog((prev) => ({ ...prev, apiLoading: true, apiError: null }));
    try {
      const apiData = await fetchShipmentFromAPI(booking.pudoRef);
      setViewDialog((prev) => ({ ...prev, apiData, apiLoading: false }));
    } catch {
      setViewDialog((prev) => ({
        ...prev,
        apiLoading: false,
        apiError: "Could not refresh data from PUDO API.",
      }));
    }
  };

  const handleEdit = (booking) => {
    const sd = booking.shipmentData || {};
    setEditForm({
      status: booking.status || "created",
      notes: booking.notes || "",
      specialInstructionsCollection: sd.special_instructions_collection || "",
      specialInstructionsDelivery: sd.special_instructions_delivery || "",
    });
    setEditDialog({ open: true, booking, saving: false });
  };

  const handleSaveEdit = async () => {
    const { booking } = editDialog;
    setEditDialog((prev) => ({ ...prev, saving: true }));
    try {
      await bookingService.update(booking.id, {
        status: editForm.status,
        notes: editForm.notes,
        shipmentData: {
          ...booking.shipmentData,
          special_instructions_collection: editForm.specialInstructionsCollection,
          special_instructions_delivery: editForm.specialInstructionsDelivery,
        },
      });

      if (booking.pudoRef) {
        try {
          const updatePayload = {
            special_instructions_collection: editForm.specialInstructionsCollection,
            special_instructions_delivery: editForm.specialInstructionsDelivery,
          };
          if (ipcRenderer) {
            await ipcRenderer.invoke("update-shipment", {
              shipmentId: booking.pudoRef,
              payload: updatePayload,
            });
          } else {
            await fetch(`${config.API_BASE_URL}/shipments/${booking.pudoRef}`, {
              method: "PUT",
              headers: getAuthHeaders(),
              body: JSON.stringify(updatePayload),
            });
          }
        } catch (apiError) {
          console.warn("PUDO API update failed (local changes saved):", apiError);
        }
      }

      showSnackbar("Shipment updated successfully");
      setEditDialog({ open: false, booking: null, saving: false });
      await loadBookings();
    } catch (error) {
      console.error("Error updating booking:", error);
      showSnackbar("Error updating shipment", "error");
      setEditDialog((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleDelete = (booking) => {
    setDeleteDialog({ open: true, booking, deleting: false, action: null });
  };

  const handleCancelShipment = async () => {
    const { booking } = deleteDialog;
    setDeleteDialog((prev) => ({ ...prev, deleting: true, action: "cancel" }));
    try {
      if (booking.pudoRef) {
        try {
          if (ipcRenderer) {
            await ipcRenderer.invoke("cancel-shipment", booking.pudoRef);
          } else {
            await fetch(`${config.API_BASE_URL}/shipments/${booking.pudoRef}`, {
              method: "DELETE",
              headers: getAuthHeaders(),
            });
          }
        } catch (apiError) {
          console.warn("PUDO API cancellation failed (updating local status anyway):", apiError);
        }
      }

      await bookingService.update(booking.id, { status: "cancelled" });
      showSnackbar("Shipment cancelled successfully");
      setDeleteDialog({ open: false, booking: null, deleting: false, action: null });
      await loadBookings();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      showSnackbar("Error cancelling shipment", "error");
      setDeleteDialog((prev) => ({ ...prev, deleting: false, action: null }));
    }
  };

  const handleDeleteRecord = async () => {
    const { booking } = deleteDialog;
    setDeleteDialog((prev) => ({ ...prev, deleting: true, action: "delete" }));
    try {
      await bookingService.delete(booking.id);
      showSnackbar("Record permanently deleted");
      setDeleteDialog({ open: false, booking: null, deleting: false, action: null });
      await loadBookings();
    } catch (error) {
      console.error("Error deleting booking:", error);
      showSnackbar("Error deleting record", "error");
      setDeleteDialog((prev) => ({ ...prev, deleting: false, action: null }));
    }
  };

  const columns = [
    {
      field: "pudoRef",
      headerName: "Waybill / Ref",
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
          {params.value || "—"}
        </Typography>
      ),
    },
    {
      field: "customerName",
      headerName: "Recipient",
      flex: 1,
      minWidth: 150,
    },
    {
      field: "lockerSize",
      headerName: "Size",
      width: 90,
      renderCell: (params) => (
        <Chip label={params.value || "—"} size="small" variant="outlined" />
      ),
    },
    {
      field: "serviceLevel",
      headerName: "Service Level",
      width: 170,
      renderCell: (params) => {
        const code = params.row.shipmentData?.service_level_code || "—";
        return (
          <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
            {code}
          </Typography>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      renderCell: (params) => {
        const cfg = getStatusConfig(params.value);
        return <Chip label={cfg.label} color={cfg.color} size="small" />;
      },
    },
    {
      field: "createdAt",
      headerName: "Created",
      width: 170,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
          {formatDate(params.value)}
        </Typography>
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 130,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => handleView(params.row)} color="info">
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleEdit(params.row)} color="primary">
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => handleDelete(params.row)} color="error">
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const { booking: viewBooking, apiData, apiLoading, apiError } = viewDialog;
  const displayData = apiData || viewBooking?.shipmentData;

  const renderContactBlock = (contact, label) => {
    if (!contact) return null;
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Person sx={{ fontSize: 16, color: "text.disabled" }} />
            <Typography variant="body2">{contact.name || "—"}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Email sx={{ fontSize: 16, color: "text.disabled" }} />
            <Typography variant="body2">{contact.email || "—"}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Phone sx={{ fontSize: 16, color: "text.disabled" }} />
            <Typography variant="body2">{contact.mobile_number || "—"}</Typography>
          </Box>
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Shipments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {bookings.length} shipment{bookings.length !== 1 ? "s" : ""} total
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
          onClick={loadBookings}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Paper sx={{ height: 620, width: "100%" }}>
        <DataGrid
          rows={bookings}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { page: 0, pageSize: 10 } },
          }}
          disableRowSelectionOnClick
          sx={{
            "& .MuiDataGrid-cell": { alignItems: "center" },
          }}
        />
      </Paper>

      {/* ─── View Dialog ─── */}
      <Dialog open={viewDialog.open} onClose={closeViewDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <LocalShipping color="primary" />
              <Box>
                <Typography variant="h6">
                  {viewBooking?.pudoRef || "Shipment Details"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {viewBooking?.customerName}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {viewBooking && (
                <Chip
                  label={getStatusConfig(apiData?.status || viewBooking.status).label}
                  color={getStatusConfig(apiData?.status || viewBooking.status).color}
                  size="small"
                />
              )}
              <Tooltip title="Refresh from PUDO API">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleRefreshAPIData}
                    disabled={apiLoading}
                  >
                    {apiLoading ? <CircularProgress size={18} /> : <Refresh fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {apiError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {apiError}
            </Alert>
          )}

          {apiLoading && !displayData && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {(displayData || viewBooking) && (
            <Grid container spacing={3}>
              {/* Summary row */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Waybill / Ref
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 700, fontFamily: "monospace" }}
                    >
                      {viewBooking?.pudoRef || "—"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Package Size
                    </Typography>
                    <Box sx={{ mt: 0.25 }}>
                      <Chip
                        label={viewBooking?.lockerSize || "—"}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Service Level
                    </Typography>
                    <Typography variant="body2">
                      {displayData?.service_level_code ||
                        viewBooking?.shipmentData?.service_level_code ||
                        "—"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(viewBooking?.createdAt)}
                    </Typography>
                  </Box>
                  {viewBooking?.notes && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography variant="body2">{viewBooking.notes}</Typography>
                    </Box>
                  )}
                </Stack>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Collection */}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Collection (Sender)
                </Typography>
                {renderContactBlock(
                  displayData?.collection_contact ||
                    viewBooking?.shipmentData?.collection_contact,
                  "Contact"
                )}
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 1.5 }}>
                  <Place sx={{ fontSize: 16, color: "text.disabled", mt: 0.3 }} />
                  <Typography variant="body2">
                    {formatAddress(
                      displayData?.collection_address ||
                        viewBooking?.shipmentData?.collection_address
                    )}
                  </Typography>
                </Box>
                {(displayData?.special_instructions_collection ||
                  viewBooking?.shipmentData?.special_instructions_collection) && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    Instructions:{" "}
                    {displayData?.special_instructions_collection ||
                      viewBooking?.shipmentData?.special_instructions_collection}
                  </Typography>
                )}
              </Grid>

              {/* Delivery */}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Delivery (Recipient)
                </Typography>
                {renderContactBlock(
                  displayData?.delivery_contact ||
                    viewBooking?.shipmentData?.delivery_contact,
                  "Contact"
                )}
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 1.5 }}>
                  <Place sx={{ fontSize: 16, color: "text.disabled", mt: 0.3 }} />
                  <Typography variant="body2">
                    {formatAddress(
                      displayData?.delivery_address ||
                        viewBooking?.shipmentData?.delivery_address
                    )}
                  </Typography>
                </Box>
                {(displayData?.special_instructions_delivery ||
                  viewBooking?.shipmentData?.special_instructions_delivery) && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    Instructions:{" "}
                    {displayData?.special_instructions_delivery ||
                      viewBooking?.shipmentData?.special_instructions_delivery}
                  </Typography>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={closeViewDialog}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<Edit />}
            onClick={() => {
              closeViewDialog();
              handleEdit(viewBooking);
            }}
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Edit Dialog ─── */}
      <Dialog
        open={editDialog.open}
        onClose={() =>
          !editDialog.saving && setEditDialog({ open: false, booking: null, saving: false })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Shipment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Ref: <strong>{editDialog.booking?.pudoRef || "—"}</strong>
              {" · "}
              Customer: <strong>{editDialog.booking?.customerName}</strong>
            </Typography>

            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={editForm.status}
                label="Status"
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                {LOCAL_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {STATUS_CONFIG[s]?.label || s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Notes (internal)"
              value={editForm.notes}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              multiline
              rows={2}
              fullWidth
              size="small"
              helperText="Stored locally — not sent to PUDO."
            />

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">
              PUDO API Fields
            </Typography>

            <TextField
              label="Special Instructions — Collection"
              value={editForm.specialInstructionsCollection}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  specialInstructionsCollection: e.target.value,
                }))
              }
              fullWidth
              size="small"
            />

            <TextField
              label="Special Instructions — Delivery"
              value={editForm.specialInstructionsDelivery}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  specialInstructionsDelivery: e.target.value,
                }))
              }
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditDialog({ open: false, booking: null, saving: false })}
            disabled={editDialog.saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            disabled={editDialog.saving}
            startIcon={editDialog.saving ? <CircularProgress size={16} /> : null}
          >
            {editDialog.saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Cancel / Delete Dialog ─── */}
      <Dialog
        open={deleteDialog.open}
        onClose={() =>
          !deleteDialog.deleting &&
          setDeleteDialog({ open: false, booking: null, deleting: false, action: null })
        }
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Cancel or Delete Shipment</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Shipment for <strong>{deleteDialog.booking?.customerName}</strong>
            {deleteDialog.booking?.pudoRef && (
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{ ml: 0.5 }}
              >
                ({deleteDialog.booking.pudoRef})
              </Typography>
            )}
          </Typography>

          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" gutterBottom>
                Cancel Shipment
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Marks the shipment as <strong>Cancelled</strong> and attempts to cancel it
                on the PUDO API. The record remains visible in this list.
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderColor: "error.light" }}>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Delete Record
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Permanently removes the booking record from the local database. This does{" "}
                <strong>not</strong> cancel the shipment on PUDO.
              </Typography>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ gap: 0.5 }}>
          <Button
            onClick={() =>
              setDeleteDialog({ open: false, booking: null, deleting: false, action: null })
            }
            disabled={deleteDialog.deleting}
          >
            Close
          </Button>
          <Button
            onClick={handleDeleteRecord}
            color="error"
            variant="outlined"
            disabled={deleteDialog.deleting}
            startIcon={
              deleteDialog.deleting && deleteDialog.action === "delete" ? (
                <CircularProgress size={16} />
              ) : null
            }
          >
            {deleteDialog.deleting && deleteDialog.action === "delete"
              ? "Deleting…"
              : "Delete Record"}
          </Button>
          <Button
            onClick={handleCancelShipment}
            color="warning"
            variant="contained"
            disabled={deleteDialog.deleting}
            startIcon={
              deleteDialog.deleting && deleteDialog.action === "cancel" ? (
                <CircularProgress size={16} />
              ) : null
            }
          >
            {deleteDialog.deleting && deleteDialog.action === "cancel"
              ? "Cancelling…"
              : "Cancel Shipment"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Snackbar ─── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ShipmentsPage;
