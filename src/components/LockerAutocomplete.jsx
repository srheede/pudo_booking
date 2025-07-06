import React, { useState, useEffect } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";

const ipcRenderer = window.require
  ? window.require("electron").ipcRenderer
  : null;

const LockerAutocomplete = ({
  value,
  onChange,
  label = "Select Locker",
  error,
  helperText,
}) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const loadTerminals = async () => {
      if (!ipcRenderer) {
        // No mock data - only show real API data
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        // Always fetch all terminals, filtering is done client-side
        const terminals = await ipcRenderer.invoke("get-all-terminals");

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

        setOptions(formattedOptions);
      } catch (error) {
        console.error("Error loading terminals:", error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    // Load all terminals on component mount
    loadTerminals();
  }, []); // Empty dependency array - only run once on mount

  // Filter options based on input value
  const filteredOptions = options.filter((option) => {
    if (inputValue.length < 2) return true; // Show all when input is short
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
      noOptionsText={
        inputValue.length < 2
          ? "Type at least 2 characters to search"
          : "No lockers found"
      }
    />
  );
};

export default LockerAutocomplete;
