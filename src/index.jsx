import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ThemeRoot from "./components/ThemeRoot.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { crashlytics } from "./firebase/crashlytics";
import { analytics } from "./firebase/analytics";
import { isCapacitor } from "./api/platform";

crashlytics.init();
analytics.init();

if (isCapacitor()) {
  import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => SplashScreen.hide())
    .catch(() => {});
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ThemeRoot>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeRoot>
  </React.StrictMode>
);
