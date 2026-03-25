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
  CircularProgress,
  Tooltip,
  Stack,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Visibility,
  Refresh,
  LocalShipping,
  Person,
  Place,
  Phone,
  Email,
  Block,
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
  "deposit-pending": { label: "Pending", color: "default" },
  "collection-pending": { label: "Pending", color: "default" },
  pending: { label: "Pending", color: "default" },
  collected: { label: "Collected", color: "warning" },
  "in-transit": { label: "In Transit", color: "primary" },
  in_transit: { label: "In Transit", color: "primary" },
  "out-for-delivery": { label: "Out for Delivery", color: "primary" },
  delivered: { label: "Delivered", color: "success" },
  "delivery-failed-attempt": { label: "Failed Attempt", color: "error" },
  "return-in-transit": { label: "Return in Transit", color: "warning" },
  cancelled: { label: "Cancelled", color: "error" },
  canceled: { label: "Cancelled", color: "error" },
  voided: { label: "Cancelled", color: "error" },
  failed: { label: "Failed", color: "error" },
};

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
  const [syncing, setSyncing] = useState(false);

  const [viewDialog, setViewDialog] = useState({
    open: false,
    booking: null,
    apiData: null,
    apiLoading: false,
    apiError: null,
  });

  const [cancelDialog, setCancelDialog] = useState({
    open: false,
    booking: null,
    cancelling: false,
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
      // Sync live PUDO statuses in the background after loading local records
      syncPudoStatuses(data);
    } catch (error) {
      console.error("Error loading bookings:", error);
      showSnackbar("Error loading shipments", "error");
    } finally {
      setLoading(false);
    }
  };

  const syncPudoStatuses = async (localBookings) => {
    if (!localBookings?.length) return;
    setSyncing(true);
    try {
      let pudoShipments;
      if (ipcRenderer) {
        pudoShipments = await ipcRenderer.invoke("get-all-shipments");
      } else {
        const response = await fetch(`${config.API_BASE_URL}/shipments`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        pudoShipments = await response.json();
      }

      if (!Array.isArray(pudoShipments)) return;

      // Build map: numeric PUDO shipment id → live status
      const pudoStatusMap = {};
      pudoShipments.forEach((s) => {
        if (s.id != null) pudoStatusMap[String(s.id)] = s.status;
      });

      // Apply live statuses; persist any changes back to Firestore
      const updated = localBookings.map((booking) => {
        const liveStatus = pudoStatusMap[String(booking.pudoRef)];
        if (liveStatus && liveStatus !== booking.status) {
          bookingService.update(booking.id, { status: liveStatus }).catch(console.error);
          return { ...booking, status: liveStatus };
        }
        return booking;
      });

      setBookings(updated);
    } catch (error) {
      console.error("Error syncing PUDO statuses:", error);
    } finally {
      setSyncing(false);
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

  const handleOpenCancel = (booking) => {
    setCancelDialog({ open: true, booking, cancelling: false });
  };

  const handleConfirmCancel = async () => {
    const { booking } = cancelDialog;
    setCancelDialog((prev) => ({ ...prev, cancelling: true }));

    try {
      // Call PUDO API: PUT /shipments/{id} with status cancelled
      if (ipcRenderer) {
        await ipcRenderer.invoke("cancel-shipment", booking.pudoRef);
      } else {
        const response = await fetch(
          `${config.API_BASE_URL}/shipments/${booking.pudoRef}`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: "cancelled" }),
          }
        );
        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`PUDO API error ${response.status}: ${errBody}`);
        }
      }

      // Only update Firestore after a successful API call
      await bookingService.update(booking.id, { status: "cancelled" });

      showSnackbar("Shipment cancelled successfully");
      setCancelDialog({ open: false, booking: null, cancelling: false });
      closeViewDialog();
      await loadBookings();
    } catch (error) {
      console.error("Error cancelling shipment:", error);
      showSnackbar("Failed to cancel shipment on PUDO API. Please try again.", "error");
      setCancelDialog((prev) => ({ ...prev, cancelling: false }));
    }
  };

  const columns = [
    {
      field: "pudoRef",
      headerName: "Waybill",
      width: 160,
      renderCell: (params) => {
        const trackingRef = params.row.shipmentData?.custom_tracking_reference;
        return (
          <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
            {trackingRef || params.value || "—"}
          </Typography>
        );
      },
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
      width: 90,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton size="small" onClick={() => handleView(params.row)} color="info">
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const { booking: viewBooking, apiData, apiLoading, apiError } = viewDialog;
  const displayData = apiData || viewBooking?.shipmentData;
  const isAlreadyCancelled = viewBooking?.status === "cancelled" || viewBooking?.status === "canceled";

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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {syncing && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <CircularProgress size={12} />
              Syncing with PUDO…
            </Typography>
          )}
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
            onClick={loadBookings}
            disabled={loading || syncing}
          >
            Refresh
          </Button>
        </Box>
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
          sx={{ "& .MuiDataGrid-cell": { alignItems: "center" } }}
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
                  {viewBooking?.shipmentData?.custom_tracking_reference ||
                    viewBooking?.pudoRef ||
                    "Shipment Details"}
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
                  <IconButton size="small" onClick={handleRefreshAPIData} disabled={apiLoading}>
                    {apiLoading ? (
                      <CircularProgress size={18} />
                    ) : (
                      <Refresh fontSize="small" />
                    )}
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
                      Waybill
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 700, fontFamily: "monospace" }}
                    >
                      {viewBooking?.shipmentData?.custom_tracking_reference || "—"}
                    </Typography>
                    {viewBooking?.pudoRef && (
                      <Typography variant="caption" color="text.disabled">
                        ID: {viewBooking.pudoRef}
                      </Typography>
                    )}
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
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: "block" }}
                  >
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
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: "block" }}
                  >
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
          {!isAlreadyCancelled && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<Block />}
              onClick={() => handleOpenCancel(viewBooking)}
            >
              Cancel Shipment
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ─── Cancel Confirmation Dialog ─── */}
      <Dialog
        open={cancelDialog.open}
        onClose={() =>
          !cancelDialog.cancelling &&
          setCancelDialog({ open: false, booking: null, cancelling: false })
        }
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Cancel Shipment</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will cancel the shipment on the PUDO API. This action cannot be undone.
          </Alert>
          <Typography>
            Cancel shipment for <strong>{cancelDialog.booking?.customerName}</strong>?
          </Typography>
          {(cancelDialog.booking?.shipmentData?.custom_tracking_reference ||
            cancelDialog.booking?.pudoRef) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Waybill:{" "}
              {cancelDialog.booking.shipmentData?.custom_tracking_reference ||
                cancelDialog.booking.pudoRef}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setCancelDialog({ open: false, booking: null, cancelling: false })
            }
            disabled={cancelDialog.cancelling}
          >
            Go Back
          </Button>
          <Button
            onClick={handleConfirmCancel}
            color="error"
            variant="contained"
            disabled={cancelDialog.cancelling}
            startIcon={
              cancelDialog.cancelling ? <CircularProgress size={16} color="inherit" /> : <Block />
            }
          >
            {cancelDialog.cancelling ? "Cancelling…" : "Confirm Cancel"}
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
