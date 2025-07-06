import React, { useState, useEffect } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";

const ipcRenderer = window.require
  ? window.require("electron").ipcRenderer
  : null;

// Cache for lockers data
let lockersCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Cache management functions
const clearLockersCache = () => {
  lockersCache = null;
  cacheTimestamp = null;
};

const isCacheValid = () => {
  const now = Date.now();
  return lockersCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION;
};

const LockerAutocomplete = ({
  value,
  onChange,
  label = "Select Locker",
  error,
  helperText,
  forceRefresh = false,
}) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const loadTerminals = async () => {
      // Check if we have valid cached data (unless force refresh is requested)
      if (!forceRefresh && isCacheValid()) {
        setOptions(lockersCache);
        return;
      }

      setLoading(true);
      try {
        let terminals;

        if (!ipcRenderer) {
          // Browser mode: make direct API call
          if (!process.env.PUDO_API_KEY) {
            throw new Error("PUDO_API_KEY environment variable is not available in browser mode");
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

        if (!terminals || !Array.isArray(terminals)) {
          console.error("Invalid terminals response:", terminals);
          setOptions([]);
          return;
        }

        const formattedOptions = terminals.map((locker) => ({
          id: locker.code,
          label: `${locker.code} - ${locker.name}`,
          terminal_id: locker.code,
          suburb: locker.place?.town || "",
          city: locker.place?.town || "",
          province: "",
          address: locker.address,
          name: locker.name,
          latitude: locker.latitude,
          longitude: locker.longitude,
        }));

        // Cache the formatted options
        lockersCache = formattedOptions;
        cacheTimestamp = Date.now();

        setOptions(formattedOptions);
      } catch (error) {
        console.error("Error loading terminals:", error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    // Load all terminals on component mount or when forceRefresh changes
    loadTerminals();
  }, [forceRefresh]); // Re-run when forceRefresh changes

  // Filter options based on input value
  const filteredOptions = options.filter((option) => {
    if (inputValue.length === 0) return true; // Show all when input is empty
    const searchTerm = inputValue.toLowerCase();
    return (
      option.terminal_id.toLowerCase().includes(searchTerm) ||
      option.name.toLowerCase().includes(searchTerm) ||
      option.address.toLowerCase().includes(searchTerm)
    );
  });

  const handleChange = (event, newValue) => {
    onChange(newValue ? newValue.terminal_id : "");
  };

  const handleInputChange = (event, newInputValue) => {
    setInputValue(newInputValue);
  };

  return (
    <Autocomplete
      value={options.find((option) => option.terminal_id === value) || null}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={filteredOptions}
      getOptionLabel={(option) => option.label || ""}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        return (
          <li key={key} {...otherProps}>
            <div>
              <div style={{ fontWeight: "bold" }}>{option.terminal_id}</div>
              <div style={{ fontSize: "0.875rem", color: "gray" }}>
                {option.name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "lightgray" }}>
                {option.address}
              </div>
            </div>
          </li>
        );
      }}
      noOptionsText="No lockers found"
    />
  );
};

export default LockerAutocomplete;
export { clearLockersCache, isCacheValid };
