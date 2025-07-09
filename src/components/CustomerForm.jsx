import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  Switch,
} from "@mui/material";
import LockerAutocomplete from "./LockerAutocomplete.jsx";
import AddressAutocomplete from "./AddressAutocomplete.jsx";

const CustomerForm = ({ open, onClose, onSave, customer = null }) => {
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
      fullAddress: "",
    },
  });

  const [errors, setErrors] = useState({});
  const [showAddressDetails, setShowAddressDetails] = useState(false);
  const [manualAddressMode, setManualAddressMode] = useState(false);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        email: customer.email || "",
        mobile: customer.mobile || "",
        deliveryType: customer.deliveryType || "locker",
        lockerId: customer.lockerId || "",
        address: {
          street: customer.address?.street || "",
          suburb: customer.address?.suburb || "",
          city: customer.address?.city || "",
          province: customer.address?.province || "",
          postalCode: customer.address?.postalCode || "",
          fullAddress: customer.address?.fullAddress || "",
        },
      });
      // Show address details if editing and there's address data
      if (
        customer.deliveryType === "address" &&
        customer.address?.fullAddress
      ) {
        setShowAddressDetails(true);
      }
    } else {
      setFormData({
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
          fullAddress: "",
        },
      });
      setShowAddressDetails(false);
      setManualAddressMode(false);
    }
    setErrors({});
  }, [customer, open]);

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

  const handleAddressChange = (addressData) => {
    setFormData((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        ...addressData,
      },
    }));

    // Show address details after selection
    if (addressData.fullAddress) {
      setShowAddressDetails(true);
    }

    // Clear address errors
    const addressErrors = [
      "address.street",
      "address.city",
      "address.province",
    ];
    setErrors((prev) => {
      const newErrors = { ...prev };
      addressErrors.forEach((field) => {
        if (newErrors[field]) {
          delete newErrors[field];
        }
      });
      return newErrors;
    });
  };

  const handleManualAddressToggle = (event) => {
    setManualAddressMode(event.target.checked);
    if (event.target.checked) {
      // When switching to manual mode, show address details
      setShowAddressDetails(true);
    } else {
      // When switching back to autocomplete, hide address details unless there's already address data
      if (!formData.address.fullAddress) {
        setShowAddressDetails(false);
      }
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

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
      onClose();
    }
  };

  const handleClose = () => {
    setFormData({
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
        fullAddress: "",
      },
    });
    setErrors({});
    setShowAddressDetails(false);
    setManualAddressMode(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {customer ? "Edit Customer" : "Add New Customer"}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
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
                <FormLabel component="legend">Delivery Type</FormLabel>
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
                  label="Select Locker"
                  error={!!errors.lockerId}
                  helperText={errors.lockerId}
                />
              </Grid>
            ) : (
              <>
                <Grid item xs={12}>
                  {!manualAddressMode ? (
                    <AddressAutocomplete
                      value={formData.address}
                      onChange={handleAddressChange}
                      label="Search Address"
                      error={!!errors["address.street"]}
                      helperText={errors["address.street"]}
                      required
                    />
                  ) : null}
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={manualAddressMode}
                        onChange={handleManualAddressToggle}
                        color="primary"
                      />
                    }
                    label="Enter address manually"
                  />
                </Grid>

                {showAddressDetails && (
                  <>
                    <Grid item xs={12}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        Address Details (you can edit these if needed):
                      </Typography>
                    </Grid>
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
              </>
            )}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          {customer ? "Update" : "Add"} Customer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomerForm;
