// Centralized configuration for the Pudo Booking App
export const config = {
  PUDO_API_KEY: "",
  API_BASE_URL: "https://api-pudo.co.za/api/v1",
};

// Helper function to get Authorization header
export const getAuthHeaders = () => ({
  Authorization: `Bearer ${config.PUDO_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

// For CommonJS compatibility (used in main.js)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { config, getAuthHeaders };
}
