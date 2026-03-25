import React, { useState, useEffect } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import config from "../../config.json";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${config.PUDO_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

const ipcRenderer = window.require
  ? window.require("electron").ipcRenderer
  : null;

let kiosksCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

const clearKiosksCache = () => {
  kiosksCache = null;
  cacheTimestamp = null;
};

const isKioskCacheValid = () => {
  const now = Date.now();
  return (
    kiosksCache && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION
  );
};

const KioskAutocomplete = ({
  value,
  onChange,
  label = "Select Kiosk",
  error,
  helperText,
  forceRefresh = false,
}) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const loadKiosks = async () => {
      if (!forceRefresh && isKioskCacheValid()) {
        setOptions(kiosksCache);
        return;
      }

      setLoading(true);
      try {
        let terminals;

        if (!ipcRenderer) {
          const response = await fetch(`${config.API_BASE_URL}/lockers-data`, {
            method: "GET",
            headers: getAuthHeaders(),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          terminals = await response.json();
        } else {
          terminals = await ipcRenderer.invoke("get-all-terminals");
        }

        if (!terminals || !Array.isArray(terminals)) {
          console.error("Invalid terminals response:", terminals);
          setOptions([]);
          return;
        }

        const kiosks = terminals.filter((t) => t.type?.id === 1);

        const formattedOptions = kiosks.map((kiosk) => ({
          id: kiosk.code,
          label: `${kiosk.code} - ${kiosk.name}`,
          terminal_id: kiosk.code,
          suburb: kiosk.place?.town || "",
          city: kiosk.place?.town || "",
          province: kiosk.detailed_address?.province || "",
          address: kiosk.address,
          name: kiosk.name,
          latitude: kiosk.latitude,
          longitude: kiosk.longitude,
        }));

        kiosksCache = formattedOptions;
        cacheTimestamp = Date.now();

        setOptions(formattedOptions);
      } catch (err) {
        console.error("Error loading kiosks:", err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    loadKiosks();
  }, [forceRefresh]);

  const filteredOptions = options.filter((option) => {
    if (inputValue.length === 0) return true;
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
      noOptionsText="No kiosks found"
    />
  );
};

export default KioskAutocomplete;
export { clearKiosksCache, isKioskCacheValid };
