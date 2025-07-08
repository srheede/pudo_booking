import React, { useState, useEffect, useRef } from "react";
import { TextField, Box, Alert } from "@mui/material";
import config from "../config.json";

const AddressAutocomplete = ({
  value,
  onChange,
  label = "Address",
  error = false,
  helperText = "",
  required = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const autocompleteRef = useRef(null);
  const inputElementRef = useRef(null);
  const retryAttempts = useRef(0);

  // Check if API key is configured
  useEffect(() => {
    if (
      !config.GOOGLE_MAPS_API_KEY ||
      config.GOOGLE_MAPS_API_KEY === "YOUR_GOOGLE_MAPS_API_KEY_HERE"
    ) {
      setLoadingError(
        "Google Maps API key not configured. Please contact support."
      );
      return;
    }
  }, []);

  // Helper function to check if Google Maps API is fully loaded
  const isGoogleMapsReady = () => {
    return (
      window.google &&
      window.google.maps &&
      window.google.maps.places &&
      window.google.maps.places.Autocomplete &&
      typeof window.google.maps.places.Autocomplete === "function"
    );
  };

  // Load Google Maps API if not already loaded
  useEffect(() => {
    if (loadingError) return; // Don't load if already have an error

    if (isGoogleMapsReady()) {
      setIsLoaded(true);
      return;
    }

    if (!document.querySelector(`script[src*="maps.googleapis.com"]`)) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${config.GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setTimeout(() => {
          if (isGoogleMapsReady()) {
            setIsLoaded(true);
            setLoadingError(null);
          }
        }, 300);
      };

      script.onerror = () => {
        setLoadingError(
          "Failed to load address suggestions. Please check your internet connection and API key."
        );
        setIsLoaded(false);
      };

      document.head.appendChild(script);
    }
  }, [loadingError]);

  // Add CSS to ensure autocomplete dropdown is visible
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .pac-container {
        z-index: 9999 !important;
        background-color: white !important;
        border: 1px solid #ccc !important;
        border-radius: 4px !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
      }
      .pac-item {
        padding: 8px 12px !important;
        border-bottom: 1px solid #eee !important;
        cursor: pointer !important;
      }
      .pac-item:hover {
        background-color: #f5f5f5 !important;
      }
      .pac-item-selected {
        background-color: #e3f2fd !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Initialize autocomplete when API is loaded
  useEffect(() => {
    if (isLoaded && inputElementRef.current && !autocompleteRef.current) {
      const initializeAutocomplete = () => {
        try {
          if (!isGoogleMapsReady()) {
            throw new Error("Google Maps API not properly loaded");
          }

          autocompleteRef.current = new window.google.maps.places.Autocomplete(
            inputElementRef.current,
            {
              types: ["address"],
              componentRestrictions: { country: "za" }, // Restrict to South Africa
            }
          );

          // Set up place selection handler
          autocompleteRef.current.addListener("place_changed", () => {
            try {
              const place = autocompleteRef.current.getPlace();

              if (place && place.geometry) {
                const addressComponents = place.address_components || [];
                const formattedAddress = place.formatted_address || "";

                // Parse address components
                const addressData = {
                  street: "",
                  suburb: "",
                  city: "",
                  province: "",
                  postalCode: "",
                  fullAddress: formattedAddress,
                };

                // Map Google Places API components to our address structure
                addressComponents.forEach((component) => {
                  const types = component.types;

                  if (types.includes("street_number")) {
                    addressData.street =
                      component.long_name + " " + addressData.street;
                  } else if (types.includes("route")) {
                    addressData.street =
                      addressData.street + component.long_name;
                  } else if (
                    types.includes("sublocality_level_1") ||
                    types.includes("neighborhood")
                  ) {
                    addressData.suburb = component.long_name;
                  } else if (types.includes("locality")) {
                    addressData.city = component.long_name;
                  } else if (types.includes("administrative_area_level_1")) {
                    addressData.province = component.long_name;
                  } else if (types.includes("postal_code")) {
                    addressData.postalCode = component.long_name;
                  }
                });

                // Clean up street address
                addressData.street = addressData.street.trim();

                // If no specific suburb found, try to extract from formatted address
                if (!addressData.suburb && formattedAddress) {
                  const parts = formattedAddress.split(",");
                  if (parts.length > 2) {
                    addressData.suburb = parts[1]?.trim() || "";
                  }
                }

                setInputValue(formattedAddress);
                onChange(addressData);
                setApiError(null);
              } else {
                setApiError(
                  "No address details found. Please try selecting a different address."
                );
              }
            } catch (error) {
              setApiError(
                "Error processing the selected address. Please try again."
              );
            }
          });

          retryAttempts.current = 0; // Reset retry attempts on success
        } catch (error) {
          // Retry logic for timing issues
          if (retryAttempts.current < 3) {
            retryAttempts.current++;
            setTimeout(() => {
              initializeAutocomplete();
            }, 1000 * retryAttempts.current);
            return;
          }

          // Provide specific error messages after retries fail
          if (error.message && error.message.includes("API key")) {
            setApiError("Invalid Google Maps API key. Please contact support.");
          } else if (error.message && error.message.includes("quota")) {
            setApiError(
              "Address search quota exceeded. Please try again later."
            );
          } else if (
            error.message &&
            error.message.includes("not properly loaded")
          ) {
            setApiError(
              "Google Maps API failed to initialize. Please refresh the page."
            );
          } else {
            setApiError(
              "Address search initialization failed. Please try refreshing the page."
            );
          }

          setIsLoaded(false);
        }
      };

      initializeAutocomplete();
    }
  }, [isLoaded, onChange]);

  // Update input value when value prop changes
  useEffect(() => {
    if (value && typeof value === "object" && value.fullAddress) {
      setInputValue(value.fullAddress);
    } else if (typeof value === "string") {
      setInputValue(value);
    }
  }, [value]);

  // Handle input changes
  const handleInputChange = (event) => {
    const newValue = event.target.value;
    setInputValue(newValue);

    // Clear API errors when user starts typing
    if (apiError) {
      setApiError(null);
    }
  };

  const handleKeyDown = (event) => {
    // Prevent form submission when pressing Enter in autocomplete
    if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  // Determine what to display as helper text
  const getHelperText = () => {
    if (helperText) return helperText;
    if (loadingError) return loadingError;
    if (apiError) return apiError;
    if (!isLoaded) return "Loading address suggestions...";
    return "";
  };

  // Determine if there's an error to show - ensure it's always a boolean
  const hasError = Boolean(error || loadingError || apiError);

  return (
    <Box>
      <TextField
        inputRef={inputElementRef}
        fullWidth
        label={label}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        error={hasError}
        helperText={getHelperText()}
        required={required}
        placeholder="Start typing an address..."
        disabled={!isLoaded || !!loadingError}
        autoComplete="off"
      />

      {/* Show detailed error alerts for better UX */}
      {loadingError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          <strong>Configuration Error:</strong> {loadingError}
        </Alert>
      )}

      {apiError && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          <strong>Address Search Error:</strong> {apiError}
        </Alert>
      )}
    </Box>
  );
};

export default AddressAutocomplete;
