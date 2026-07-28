import React, { useState, useEffect, useRef } from "react";
import { TextField, Box, Alert } from "@mui/material";
import config from "../../config.json";

const MAPS_SCRIPT_ID = "pudo-google-maps-places";

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
    }
  }, []);

  const isGoogleMapsReady = () => {
    return (
      window.google &&
      window.google.maps &&
      window.google.maps.places &&
      typeof window.google.maps.places.Autocomplete === "function"
    );
  };

  // Wait until Places is actually usable (Windows + AV can delay script init).
  const waitForGoogleMaps = (timeoutMs = 15000) =>
    new Promise((resolve, reject) => {
      if (isGoogleMapsReady()) {
        resolve();
        return;
      }
      const started = Date.now();
      const timer = setInterval(() => {
        if (isGoogleMapsReady()) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error("Timed out waiting for Google Maps Places API"));
        }
      }, 100);
    });

  // Load Google Maps Places — use the callback param (not loading=async) so
  // Places is ready when onload/callback fires. Poll as a backup.
  useEffect(() => {
    if (loadingError) return;

    let cancelled = false;

    const markReady = async () => {
      try {
        await waitForGoogleMaps();
        if (!cancelled) {
          setIsLoaded(true);
          setLoadingError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadingError(
            "Failed to load address suggestions. You can still enter the address manually below."
          );
          setIsLoaded(false);
        }
      }
    };

    if (isGoogleMapsReady()) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.getElementById(MAPS_SCRIPT_ID);
    if (existing) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    window.__pudoInitGoogleMaps = () => {
      markReady();
    };

    const script = document.createElement("script");
    script.id = MAPS_SCRIPT_ID;
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(config.GOOGLE_MAPS_API_KEY)}` +
      `&libraries=places&callback=__pudoInitGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      if (!cancelled) {
        setLoadingError(
          "Failed to load address suggestions. Please check your internet connection, then use manual address entry."
        );
        setIsLoaded(false);
      }
    };
    document.head.appendChild(script);

    // Backup poll in case callback is blocked by CSP/referrer quirks.
    markReady();

    return () => {
      cancelled = true;
    };
  }, [loadingError]);

  // Keep the Places dropdown above MUI dialogs
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .pac-container {
        z-index: 10000 !important;
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
              componentRestrictions: { country: "za" },
              fields: [
                "address_components",
                "formatted_address",
                "geometry",
                "name",
              ],
            }
          );

          autocompleteRef.current.addListener("place_changed", () => {
            try {
              const place = autocompleteRef.current.getPlace();

              if (place && place.geometry) {
                const addressComponents = place.address_components || [];
                const formattedAddress = place.formatted_address || "";

                const addressData = {
                  street: "",
                  suburb: "",
                  city: "",
                  province: "",
                  postalCode: "",
                  fullAddress: formattedAddress,
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                };

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
                    types.includes("sublocality") ||
                    types.includes("neighborhood")
                  ) {
                    addressData.suburb = component.long_name;
                  } else if (types.includes("locality")) {
                    addressData.city = component.long_name;
                  } else if (types.includes("administrative_area_level_1")) {
                    addressData.province = component.short_name;
                  } else if (types.includes("postal_code")) {
                    addressData.postalCode = component.long_name;
                  }
                });

                addressData.street = addressData.street.trim();

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
                  "No address details found. Please try selecting a different address, or enter it manually."
                );
              }
            } catch (error) {
              setApiError(
                "Error processing the selected address. Please try again or enter it manually."
              );
            }
          });

          retryAttempts.current = 0;
        } catch (error) {
          if (retryAttempts.current < 5) {
            retryAttempts.current++;
            setTimeout(() => {
              initializeAutocomplete();
            }, 500 * retryAttempts.current);
            return;
          }

          if (error.message && error.message.includes("API key")) {
            setApiError("Invalid Google Maps API key. Please contact support.");
          } else if (error.message && error.message.includes("quota")) {
            setApiError(
              "Address search quota exceeded. Please try again later."
            );
          } else {
            setApiError(
              "Address search unavailable. Please use manual address entry."
            );
          }
        }
      };

      initializeAutocomplete();
    }
  }, [isLoaded, onChange]);

  useEffect(() => {
    if (value && typeof value === "object" && value.fullAddress) {
      setInputValue(value.fullAddress);
    } else if (typeof value === "string") {
      setInputValue(value);
    }
  }, [value]);

  const handleInputChange = (event) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    if (apiError) {
      setApiError(null);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  const getHelperText = () => {
    if (helperText) return helperText;
    if (loadingError) return loadingError;
    if (apiError) return apiError;
    if (!isLoaded) return "Loading address suggestions...";
    return "";
  };

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
        // Keep the field usable even if Maps fails — manual entry is the fallback.
        disabled={false}
        autoComplete="off"
      />

      {loadingError && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {loadingError}
        </Alert>
      )}

      {apiError && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {apiError}
        </Alert>
      )}
    </Box>
  );
};

export default AddressAutocomplete;
