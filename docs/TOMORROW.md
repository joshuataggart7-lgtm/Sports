# Padres by tomorrow: the shortest path

Goal: watch the Padres with the system live, in the room as it is today, no remount, no new
hardware. Everything below runs on what you own. Total hands-on time is about two hours, and
most of it is waiting for installs.

What "live" means tomorrow: the app on the iPad, the Padres game feeding real scores, the
ribbon projected on a wall, a stats board and league scores on the two spare TVs, the Sony
showing the broadcast, and the horn, bias lights and ribbon takeover when the Padres score.
Not tomorrow: the fog machine, the goal light and the screen drop (nothing to plug them into
yet), and the TV wall remount.

## The night before (about 60 min)

1. **Run the agent on the Mac.** Open Terminal, then:
   ```bash
   git clone https://github.com/joshuataggart7-lgtm/Sports.git room-os
   cd room-os && git checkout claude/connected-room-alternative-mey6nd
   ./scripts/start-mac.sh
   ```
   It installs Node if needed, builds the app, prints the address, and starts with live ESPN
   data. Leave that Terminal window open. If anything in it turns red, send me a screenshot.
2. **Put the app on the iPad.** Safari → the address it printed → Share → Add to Home Screen.
   Open it. Settings → Watched game → pick **SD @ MIL**. Favorite teams already include SD.
3. **Sony IP control.** On the TV: Settings → Network → Home network setup → IP control →
   Authentication "Normal and Pre-Shared Key", set a key, Simple IP control On. Then in the
   app → Settings → Devices → Sony → config `{"host":"<TV IP>","psk":"<key>"}`. The row should
   flip to CONNECTED. TV IP is under Settings → Network → Network status.
4. **Roku TVs.** On each: Settings → System → Power → Fast TV Start On. Note the IP under
   Settings → Network → About. In the app, each TV's config `{"host":"<ip>"}`. CONNECTED.
5. **Receiver.** Find the Onkyo's IP (Setup → Network, or your router's device list). In the
   app, the receiver's config `{"host":"<ip>"}`. If it shows CONNECTED, tap On/Off once on
   the Room page to prove it.
6. **Projectors.** On each XGIMI: Settings → Device Preferences → About → press OK on Build
   seven times → Developer options → USB debugging and Network debugging On. Note the IP. In
   the app, config `{"host":"<ip>"}` for each. The first command pops an "Allow debugging?"
   prompt on the projector; tick Always allow.
7. **Sound.** Plug any speaker into the Mac or pick one in Sound output. On the Live page tap
   CELEBRATION. You should hear the fanfare. If you have an air-horn or fight-song MP3, drop
   it in `room-os/packages/agent/sounds/` as `touchdown.mp3` and `sd_celebration.mp3`.

## Game day morning (about 45 min)

8. **Screens.** Fire Stick into the right Roku TV: Settings → My Fire TV → Developer options →
   ADB debugging On; Screensaver → Never. Old computer into the left Roku TV: Chrome, open the
   display URL from the Displays page for "Left TV", press F11. Both TVs show their role.
9. **Ribbon.** Put the MoGo 2 Plus on a table or shelf aimed at any open wall or the top of
   the window wall, 8 to 12 ft back. HDMI from the Mac to the MoGo, or open the ribbon URL on
   the MoGo's own browser. On the Displays page → Projector → set the viewport so only the
   band you want lights up; everything else is black.
10. **Lights.** Only if you picked up WLED strips: plug in, join them to Wi-Fi with the WLED
    app, enter each strip's IP in the app. Otherwise skip; the ribbon and horn carry the
    celebration.
11. **Rehearsal, 10 minutes before first pitch.** Room page → GAME DAY. Watch the Timeline
    page: every device should log what it did. Live page → tap TOUCHDOWN once to see the full
    choreography (it works for any sport). Tap RESET ROOM.

## During the game

12. **First Padres run: tap SYNC TO TV** the moment you see it cross the plate on the Sony.
    The app measures how far behind the feed your stream is (FS1 on YouTube TV is usually 20
    to 40 s) and every celebration after that lands on the TV moment, not the feed moment.
13. If the feed hiccups, the manual buttons always work. If something fires that should not,
    the Timeline says why, and "Pause automations 1h" on the Live page stops everything.

## What to send me as you go

A screenshot of the Home page once the agent is running, and the IPs you entered. I will
watch for anything the ESPN feed does differently in a live playoff game and push fixes
during the day. If a driver stays OFFLINE after you enter its IP, send the row and I will
tell you which setting on that device to flip.
