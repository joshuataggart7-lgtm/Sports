import { useNavigate } from "react-router";
import { api } from "../app/api";
import { favoriteSide, primaryGame, useRoom } from "../app/store";
import { Button, Card, Dot, StatusTag } from "../components/ui";
import { ScoreBlock } from "../components/Score";

export function Home() {
  const { snapshot: s, connected } = useRoom();
  const nav = useNavigate();
  if (!s) return <Connecting />;
  const game = primaryGame(s);
  const live = game && (game.status === "live" || game.status === "halftime");
  const upcoming = s.games.filter((g) => g.id !== game?.id).sort((a, b) => (a.status === "live" ? -1 : 1) - (b.status === "live" ? -1 : 1) || a.startTime - b.startTime).slice(0, 5);
  const dev = (id: string) => s.devices.find((d) => d.id === id);
  const on = (id: string) => dev(id)?.state.power === "on";
  const anyOn = (ids: string[]) => ids.some(on);
  const gameDay = s.room.mode === "GAME_DAY";

  return (
    <div className="space-y-5 rise">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{s.room.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-mute"><Dot on={connected} /> {connected ? "Online" : "Reconnecting"} · {s.room.mode ? `${s.room.mode.replace("_", " ")} mode` : "Idle"}</div>
        </div>
        <StatusTag status={s.agent.provider.status} />
      </header>

      <Card title={live ? "Now" : game?.status === "final" ? "Final" : "Tonight"}>
        {game ? (
          <div className="space-y-5">
            <ScoreBlock game={game} favoriteSide={favoriteSide(s, game)} />
            <div className="text-center text-sm text-mute">{game.home.name} vs {game.away.name}{game.broadcast ? ` · ${game.broadcast}` : ""}{game.venue ? ` · ${game.venue}` : ""}</div>
            <Button big variant={gameDay ? "default" : "primary"} className="w-full tracking-wide" onClick={() => (gameDay ? nav("/game") : api("/api/mode", { mode: "GAME_DAY" }).then(() => nav("/game")))}>
              {gameDay ? "GAME DAY IS ON · OPEN LIVE" : "START GAME DAY"}
            </Button>
          </div>
        ) : <div className="py-8 text-center text-mute">No game selected. Pick one in Settings.</div>}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Room">
          <ul className="space-y-2.5 text-sm">
            <Row label="Main TV" on={on("tv_sony")} />
            <Row label="Projector" on={on("projector")} note={dev("projector")?.state.input === "ribbon" ? "ribbon" : dev("projector")?.state.input} />
            <Row label="Aux screens" on={anyOn(["tv_left", "tv_right"])} />
            <Row label="Audio" on={on("avr")} note={dev("avr")?.state.input} />
            <Row label="Lights" on={anyOn(["bias_lights", "room_leds", "lamps"])} />
            <Row label="Room Agent" on={connected} note={`${s.agent.provider.id} · ${Object.values(s.agent.drivers).includes("CONNECTED") ? "hardware connected" : "simulated devices"}`} />
          </ul>
        </Card>
        <Card title="Upcoming" right={<span className="text-xs text-mute">{s.games.length} games today</span>}>
          <ul className="divide-y divide-line">
            {upcoming.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2.5 text-sm">
                <div><span className="font-semibold">{g.away.abbreviation} @ {g.home.abbreviation}</span> <span className="ml-2 text-xs uppercase text-mute">{g.leagueId}</span></div>
                <div className="tnum text-mute">{g.status === "live" ? <span className="text-fog">{g.awayScore}–{g.homeScore} <span className="text-alert">●</span> {g.periodLabel}</span> : g.status === "final" ? `F ${g.awayScore}–${g.homeScore}` : new Date(g.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, on, note }: { label: string; on: boolean; note?: string }) {
  return <li className="flex items-center justify-between"><span>{label}</span><span className="flex items-center gap-2 text-mute">{note && <span className="text-xs">{note}</span>}<Dot on={on} /></span></li>;
}

export function Connecting() {
  const { authFailed } = useRoom();
  return <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-mute"><Dot on="warn" /> {authFailed ? <span>PIN required. Set it in <a className="underline" href="/settings">Settings</a>.</span> : "Connecting to the Room Agent…"}</div>;
}
