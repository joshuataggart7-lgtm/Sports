import { useEffect } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router";
import { connect, useRoom } from "./app/store";
import { Home } from "./pages/Home";
import { LiveGame } from "./pages/LiveGame";
import { RoomControl } from "./pages/RoomControl";
import { Displays } from "./pages/Displays";
import { Automations } from "./pages/Automations";
import { Timeline } from "./pages/Timeline";
import { Settings } from "./pages/Settings";
import { Guest } from "./pages/Guest";
import { DisplayPage } from "./display/DisplayPage";
import { Dot } from "./components/ui";

const NAV = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/game", label: "Live", icon: "◉" },
  { to: "/room", label: "Room", icon: "▣" },
  { to: "/displays", label: "Displays", icon: "▭" },
  { to: "/automations", label: "Automate", icon: "⚡" },
  { to: "/timeline", label: "Timeline", icon: "≡" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function App() {
  const loc = useLocation();
  const isDisplay = loc.pathname.startsWith("/display/");
  const isGuest = loc.pathname.startsWith("/guest");
  useEffect(() => { if (!isDisplay) connect({ role: "app" }); }, [isDisplay]);
  if (isDisplay) return <Routes><Route path="/display/:id" element={<DisplayPage />} /></Routes>;
  if (isGuest) return <Routes><Route path="/guest" element={<Guest />} /></Routes>;
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 pb-24 md:pb-8">
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6 safe-t">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<LiveGame />} />
            <Route path="/room" element={<RoomControl />} />
            <Route path="/displays" element={<Displays />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
      </main>
      <TabBar />
    </div>
  );
}

function Sidebar() {
  const { snapshot, connected } = useRoom();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-panel/60 p-5 md:block">
      <div className="mb-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mute">Room OS</div>
        <div className="mt-1 flex items-center gap-2 text-lg font-bold">{snapshot?.room.name ?? "Room"} <Dot on={connected} /></div>
        <div className="mt-1 text-xs text-mute">{snapshot?.room.mode ? snapshot.room.mode.replace("_", " ") : "No mode"} · {connected ? "Agent online" : "Connecting…"}</div>
      </div>
      <nav className="space-y-1">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-panel2 text-fog" : "text-mute hover:text-fog"}`}>
            <span className="w-5 text-center text-base">{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-8 border-t border-line pt-4 text-xs text-mute">
        <NavLink to="/guest" className="hover:text-fog">Guest mode →</NavLink>
      </div>
    </aside>
  );
}

function TabBar() {
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line px-2 pt-2 safe-b md:hidden">
      {NAV.slice(0, 5).map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `flex w-14 flex-col items-center gap-0.5 pb-2 text-[10px] font-medium ${isActive ? "text-fog" : "text-mute"}`}>
          <span className="text-xl leading-none">{n.icon}</span>{n.label}
        </NavLink>
      ))}
    </nav>
  );
}
