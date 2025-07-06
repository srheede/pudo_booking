import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  Snackbar,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import { Save } from "@mui/icons-material";
import { senderService } from "../firebase/services";
import LockerAutocomplete from "../components/LockerAutocomplete.jsx";

const SenderPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    deliveryType: "locker",
    lockerId: "",
    address: {
      street: "",
      suburb: "",
      city: "",
      province: "",
      postalCode: "",
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    loadSenderData();
  }, []);

  const loadSenderData = async () => {
    try {
      setLoading(true);
      const senderData = await senderService.get();
      if (senderData) {
        setFormData({
          name: senderData.name || "",
          email: senderData.email || "",
          mobile: senderData.mobile || "",
          deliveryType: senderData.deliveryType || "locker",
          lockerId: senderData.lockerId || "",
          address: {
            street: senderData.address?.street || "",
            suburb: senderData.address?.suburb || "",
            city: senderData.address?.city || "",
            province: senderData.address?.province || "",
            postalCode: senderData.address?.postalCode || "",
          },
        });
      }
    } catch (error) {
      console.error("Error loading sender data:", error);
      showSnackbar("Error loading sender data", "error");
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleLockerChange = (lockerId) => {
    setFormData((prev) => ({
      ...prev,
      lockerId,
    }));
    if (errors.lockerId) {
      setErrors((prev) => ({
        ...prev,
        lockerId: "",
      }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.mobile.trim()) newErrors.mobile = "Mobile number is required";

    if (formData.deliveryType === "locker") {
      if (!formData.lockerId)
        newErrors.lockerId = "Locker selection is required";
    } else {
      if (!formData.address.street.trim())
        newErrors["address.street"] = "Street address is required";
      if (!formData.address.city.trim())
        newErrors["address.city"] = "City is required";
      if (!formData.address.province.trim())
        newErrors["address.province"] = "Province is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      await senderService.update(formData);
      showSnackbar("Sender details saved successfully");
    } catch (error) {
      console.error("Error saving sender data:", error);
      showSnackbar("Error saving sender details", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <Typography>Loading...</Typography>
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
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Sender Details
        </Typography>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Details"}
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={handleChange("name")}
              error={!!errors.name}
              helperText={errors.name}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={handleChange("email")}
              error={!!errors.email}
              helperText={errors.email}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Mobile Number"
              value={formData.mobile}
              onChange={handleChange("mobile")}
              error={!!errors.mobile}
              helperText={errors.mobile}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Collection Type</FormLabel>
              <RadioGroup
                row
                value={formData.deliveryType}
                onChange={handleChange("deliveryType")}
              >
                <FormControlLabel
                  value="locker"
                  control={<Radio />}
                  label="Locker"
                />
                <FormControlLabel
                  value="address"
                  control={<Radio />}
                  label="Address"
                />
              </RadioGroup>
            </FormControl>
          </Grid>

          {formData.deliveryType === "locker" ? (
            <Grid item xs={12}>
              <LockerAutocomplete
                value={formData.lockerId}
                onChange={handleLockerChange}
                label="Collection Locker"
                error={!!errors.lockerId}
                helperText={errors.lockerId}
              />
            </Grid>
          ) : (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Street Address"
                  value={formData.address.street}
                  onChange={handleChange("address.street")}
                  error={!!errors["address.street"]}
                  helperText={errors["address.street"]}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Suburb"
                  value={formData.address.suburb}
                  onChange={handleChange("address.suburb")}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="City"
                  value={formData.address.city}
                  onChange={handleChange("address.city")}
                  error={!!errors["address.city"]}
                  helperText={errors["address.city"]}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Province"
                  value={formData.address.province}
                  onChange={handleChange("address.province")}
                  error={!!errors["address.province"]}
                  helperText={errors["address.province"]}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Postal Code"
                  value={formData.address.postalCode}
                  onChange={handleChange("address.postalCode")}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

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

export default SenderPage;
