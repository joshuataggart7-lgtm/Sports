# Setup guide: exactly what to do so the build can keep going

Each step says where to click and what to send back. Do them in order; the first four take
about an hour and unblock the rest. Send answers as a message, a screenshot, or by filling in
the inventory table in `docs/ROOM_PLAN.md`.

## Step 1. Model numbers (15 min)

For each item, photograph the label on the back or read it from the settings menu:

- **Sony TV**: Settings → System (or Help) → About → Model. Looks like `XR-65A80L` or `KD-55X80K`.
- **Aux TVs**: label on the back. Brand and model.
- **Projector**: label underneath. Brand and model, plus whether it has an **Ethernet (LAN) port** on the back.
- **Motorized screen**: label on the end cap of the housing (the white tube above the window in your photos). Brand and model, and how you operate it today: wall switch, RF remote, IR remote, or 12 V trigger from the projector.
- **Receiver**: label on the back. Brand and model.
- **The two small speakers on wall mounts** and the **surround speakers** on the walls: brand and model (they decide whether they can be the rear channels).
- **Light strips / smart lamps**, if you own any: brand (Govee, Hue, LIFX, Nanoleap, WLED, other).
- **Streaming box on the TV**: Apple TV (which generation), Roku, Fire TV, or the TV's own apps.

## Step 2. Network (20 min)

1. Find your router's admin page (usually `192.168.1.1` or `192.168.0.1`; the address is on the router label). Sign in.
2. Open the client/device list and write down the IP of: the Sony TV, the projector (if networked), the receiver, the streaming box, any light hubs.
3. Set a **DHCP reservation** (also called "static lease" or "always use this IP") for each of those so the addresses never change. Same for the computer that will run the Room Agent.
4. Send me the list: device → IP.

If your router is an ISP box with no reservation option, say so and we will use hostnames instead.

## Step 3. Sony TV IP control (5 min)

On the TV: Settings → Network & Internet → Home network setup (or "Home network") → **IP control**:

- Authentication: **Normal and Pre-Shared Key**
- Pre-Shared Key: pick a 4 to 8 character key and write it down
- Simple IP control: **On**
- Also under Remote start / "Remote device settings", turn on **Remote start** so the TV can wake over the network.

Send me the key and the TV's IP. The `bravia` driver needs only those two things.

## Step 4. Projector network (10 min)

If the projector has a LAN port: plug it into the router (or a switch), then in the projector's menu
find Network → Wired LAN → turn on DHCP, note the IP, and look for a **PJLink** item (often under
Network → Control or Advanced). Enable it. If it asks for a PJLink password, set one and send it.
If the only network is Wi-Fi via a dongle, tell me the model and I will check.

If it has no network port, we control it through the 12 V trigger / IR via Home Assistant instead;
the `pjlink` driver is then not used.

## Step 5. The room agent computer (30 min)

Any always-on machine works: a Mac mini, an Intel NUC, an old laptop, or a Raspberry Pi 4/5.

1. Install Node.js 20 or newer from nodejs.org (or `brew install node` on a Mac).
2. Install Git, then in a terminal:
   ```bash
   git clone https://github.com/joshuataggart7-lgtm/Sports.git room-os
   cd room-os
   git checkout claude/connected-room-alternative-mey6nd
   npm install
   npm run build -w @room/web
   npm run agent
   ```
3. On your phone, open `http://<that computer's IP>:8790`. In Safari tap Share → **Add to Home Screen**. That is the app.
4. Tell me it came up, and send a screenshot of the Home screen.

## Step 6. Home Assistant (an evening)

Home Assistant handles the receiver, the screen, the streaming box and any Hue/Govee lights.

1. Easiest path: install **Home Assistant OS** on a Raspberry Pi 4 (or in a VM on the agent computer). Follow the official "Installation" page for your hardware; it is a flash-and-boot process.
2. Open `http://homeassistant.local:8123`, create the account, and let it auto-discover devices on the network. Add integrations for: your receiver brand (Denon/Marantz, Yamaha, Onkyo, Sony all exist), Apple TV (if you have one), your lights, and a **Bond Bridge** or **Broadlink** if the screen uses an RF/IR remote.
3. Create a token: click your profile picture (bottom left) → Security → **Long-lived access tokens** → Create. Copy it.
4. Start the agent with it:
   ```bash
   HA_URL=http://homeassistant.local:8123 HA_TOKEN=<paste> npm run agent
   ```
5. In the app → Settings → Devices, set each HA-controlled device's driver to `homeassistant` and its config to `{"entityId": "media_player.receiver"}` (the entity ids are under HA → Settings → Devices & services → Entities).
6. Send me the list of entity ids. I will put them in the seed so a fresh install is already mapped.

## Step 7. Supabase, only if you want login and cloud sync (20 min)

Local-only works fine for one room. If you want the app usable away from home with an account:

1. Go to supabase.com → New project. Name it `room-os`, pick a region near you, set a database password.
2. Project → SQL Editor → paste the contents of `supabase/migrations/0001_room_os.sql` → Run.
3. Project → Settings → API: copy the **Project URL** and the **anon public** key.
4. Send me both. The anon key is safe to share; never send the `service_role` key.

## Step 8. Sports data decision

- Keep the free ESPN reader for now: nothing to do, `PROVIDER=espn` on the agent.
- Or a licensed feed with play-by-play: create an account at sportsdata.io (NFL + NCAA football trial keys are free for a period), send me the API key, and I will add the provider.

## Step 9. Measurements for the projector ribbon (10 min)

With a tape measure:

1. Width of the TV wall, floor to ceiling height, and the distance from the TV wall to the opposite wall.
2. Where the ceiling fan is relative to the TV wall (distance from the TV wall to the fan's center).
3. The width of the TV array you want (Sony width + the two aux TVs + gaps).

## What happens on my side as each step lands

| You send | I do |
|---|---|
| Models + IPs | Pre-fill the room seed with your real devices, groups and inputs; pick drivers; flag anything that needs an adapter |
| Sony PSK | Verify the `bravia` driver live and mark it CONNECTED |
| Projector on the network | Verify `pjlink`, map HDMI inputs, add power-on warm-up handling |
| Agent running | Walk you through pairing each screen and the first Game Day rehearsal |
| HA token + entity ids | Verify receiver, screen and lights; wire the real celebration choreography |
| Supabase keys | Apply the schema, add the cloud store adapter and sign-in |
| Measurements | Give you exact ribbon viewport numbers and the projector mounting position |
