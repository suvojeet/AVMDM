import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import StudioAssistantWidget from "../chat/StudioAssistantWidget";

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-averio-dark">
          <Outlet />
        </main>
      </div>
      <StudioAssistantWidget />
    </div>
  );
}
