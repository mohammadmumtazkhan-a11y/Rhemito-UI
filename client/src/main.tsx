import { createRoot } from "react-dom/client";
import App from "./App";
import { installDeviceIdHeader } from "./lib/deviceId";
import "./index.css";

installDeviceIdHeader();

createRoot(document.getElementById("root")!).render(<App />);
