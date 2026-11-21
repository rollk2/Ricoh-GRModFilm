# GR Mod Film

GR Mod Film is a fork of [GR Mod](https://github.com/Maxwooow/Ricoh-GRMod) by Maxwooow that adds a
**film mode** to the Ricoh GR III (firmware 2.10) and GR IIIx (firmware 1.60). Everything GR Mod
does is kept (version 1.1 follows GR Mod 0.8.15). Not a Ricoh product, not an official GR Mod release.

| Camera | Official firmware | GR Mod features | Film mode |
| --- | --- | --- | --- |
| GR III / GR III HDF | 2.10 | yes | **yes** (camera-tested) |
| GR IIIx / GR IIIx HDF | 1.60 | yes | **yes** (same program as the GR III 2.10, not camera-tested) |
| GR III / GR IIIx | 2.20, 2.21 / 1.70, 1.71 | yes | not yet (planned) |
| GR IV / GR IV HDF | 1.21, 1.20, 1.11 | yes | not yet (planned) |
| GR IV Monochrome | 1.11, 1.10 (the GR IV 1.21 and 1.20 files) | yes | not yet (planned) |

GR Mod features on the GR IV, the GR IV Monochrome and the newer GR III / IIIx firmwares are GR Mod's own,
camera-tested by Maxwooow; GR Mod Film adds nothing to them yet. A camera updated to a newer Ricoh
firmware cannot go back to an older one: keep a GR III on 2.10 for the film mode.

Version 1.3.0 (the latest is always on the [Releases](https://github.com/rollk2/Ricoh-GRModFilm/releases/latest) page).

## What is new in 1.3.0 (GR IV Monochrome 1.11, the GR IV 1.21 file)

- **Black-and-white recipes**: the Image Control page of the GR IV Monochrome now adds looks of your own (up to 20), each made
  from a `.cube` LUT. The sensor has no colour, so only the LUT's tone curve on the grey axis is used, applied on top of
  Monochrome Standard; the app warns when a LUT tints the picture or mixes the channels (a filter, a film's colour response),
  which a monochrome sensor cannot reproduce.
- Each recipe has its own name, icon and parameters (contrast, sharpness, grain...), set in the camera and kept for each
  recipe; in-camera RAW development works with them (with the camera's own aspect ratios only, as for every added look).
- **Monochrome recipe packs**: export and import your black-and-white recipes (`.grfrecipes`, name, icon and LUT). A
  Monochrome pack is refused on another camera; GR Mod Film 1.2 and earlier say it comes from a newer version.
- Tried on a GR IV Monochrome 1.11 with two recipes (Agfa APX 100 and Fuji Neopan Acros 100 LUTs).

## What is new in 1.2.0 (GR IV Monochrome 1.11, the GR IV 1.21 file)

- **No movie** (an option on the Features page): the Movie tab, Still/Movie, Movie Edit and the movie functions are taken out.
- **Custom buttons, always on** (as the Hold buttons are on the GR III): every function can go on every button
  (Flash Exp. Comp., Airplane Mode and Macro Mode added to the lists); a Hold (long press) line under the line of
  Fn, ISO, Drive, the fourth key and the Macro key in Fn Button Setting; a Macro Button line for the up key; and Red Filter on
  the ADJ lever (the Monochrome has no ND filter). The new lines are named in the 21 languages as on the GR III.
- Tried on a GR IV Monochrome 1.11. The same file is used by the GR IV and the GR IV HDF, which have not been tried.

## What the film mode does (GR III / IIIx)

- **One BOX = one roll.** Prepare a film (Image Control) and a format (aspect ratio) with the
  normal menus, turn **Film Roll Mode** on in the « Film Mode » tab and Save Settings into a BOX.
  On U1, U2 or U3, that BOX then behaves like a camera loaded with a roll: frame counter
  (frame/total) on screen, a folder of its own on the card, multiple exposure forced. Saving
  other settings into a started roll's BOX rewinds it.
- **Film Advance**: a Fn button function to advance the film (a cartridge icon).
- **New roll**: a short message when a roll ends (2 s, OK closes it); **Rewind** (Execute /
  Cancel) in the Film Mode tab ends a roll by hand.
- **Files named after the film**: `PORT6857.JPG` for a film coded PORT, folders such as
  `174POR36`; the camera's own looks have codes too (STND, VIVD, MONO, NEGF…). The photos of P, Av,
  Tv and M always go into one folder.
- **Changed card**: a roll whose folder is gone starts again on a new roll.
- **Formatting the card** (0.9.5) rewinds every loaded roll (U1, U2, U3 and the other BOXes): the
  counters start again from the first frame.
- **No movie** (an option of its own): Movie Settings, Still/Movie, Movie Edit and the movie Fn
  functions are taken out; the side button is called « Wireless Button ». Its tab becomes the
  « Film Mode » tab, shown in U modes only.
- **Mode Memory**, two more boxes: **AF Point** (after Focus; unticked, the AF point goes back to
  the centre at power-on) and **Apply to U modes** (last; ticked, Mode Memory also applies in U1 to
  U3, at power-on and when the dial recalls a U mode; the BOXes saved are never changed). In a BOX
  with Film Roll Mode on, Mode Memory never touches the roll's Image Control, Aspect Ratio and Drive.
  With No movie, Still/Movie is not in the list.
- **Standard can be hidden** from the Image Control list (0.9.1): a hidden look in use, or Standard
  after a reset, becomes the first camera look shown in your order. One camera look stays shown.
- **WB and Macro buttons in Fn Button Settings** (0.9.2): two lines under Drive Button, « WB
  Button » and « Macro Button », give these keys any Fn function (Film Advance included); left as
  they are, they keep White Balance and Macro Mode. White Balance and Macro Mode also become
  functions for the other buttons.
- **Grain** (0.9.3): a « Grain Effect » row (Off / 1 / 2 / 3) on each GR Mod film's parameter
  screen, rendered by the camera's own grain (as its monochrome looks do), so shooting and power-off
  stay as fast as without it. Films only; the camera's own looks are unchanged.
- **Hold lines** (0.9.3): Fn Button Settings has a « Hold » line under each of Fn, ISO, Drive, WB
  and Macro Button. A long press runs that function: the 4-way pad's keys while held, Fn when
  released after 0.6 s or more. With a Hold function set, the key's short press runs on release.
  Left Off (the default), the key works as before. Outside shooting (menus, playback) and while
  the 4-way pad moves the AF point, nothing changes.
- **Wireless Button and Hold Wireless Btn.** (0.9.3) now offer the same functions as the other
  buttons: Film Advance, White Balance and Macro Mode were missing from their lists.
- **Rear dial off** (an option of its own, for a faulty dial): the rear dial's rotation is ignored
  everywhere; its four keys and OK work as before. With the film mode (0.9.4), **hold Fn and turn
  the front dial** to do what the rear dial did (the depth of field in Snap Distance Priority, for
  one). Fn's own function then runs when Fn is released, and not at all after such a turn. The Snap
  DOF button function of 0.9.3 is gone (Fn + front dial does it).
- **Rewind Film on a button** (0.9.6): Fn Button Settings offers « Rewind Film » (with Film Advance,
  White Balance and Macro Mode, at the end of the lists). In a U mode with a started roll, the
  button asks « Rewind the film? » for 4 s: OK rewinds (then « New roll loaded. »), MENU or waiting
  cancels.
- **Roll lock** (0.9.4): while a roll is loaded (not rewound), Image Control, Aspect Ratio, Crop,
  Drive Mode, File Format, JPEG Recorded Pixels and Color Space leave the menu, their button and
  ADJ lever functions run Off: the roll's film and format cannot change by mistake.
- **Hide Settings** (0.9.7, in the camera: Setup > Hide Settings, under Firmware Info/Options): a list
  of boxes for Face/Eye Detection, AF Assist Light, AF.C Setting, MF Auto Magnification, Flash Mode,
  GF-2 Flash Mode and Flash Exposure Comp. A ticked setting leaves the menu, the buttons' lists (Hold
  and Wireless included), ADJ Mode Setting's lists and Mode Memory at once; a button or ADJ slot
  still holding it does nothing; its value stays as it was. Unticked, it comes back. Ticking Flash
  Mode, GF-2 or Flash Exposure Comp. also ticks its Mode Memory box, so that power-on keeps the value.
  From 0.9.4 to 0.9.6 the settings were hidden from the program, each held at a value chosen there;
  after updating to 0.9.7 nothing is hidden until ticked in the camera.
- **Settings file** (0.9.8, in the camera: Setup > Save Settings to Card and Load Settings from Card,
  under Hide Settings): Save writes every setting (the settings in use and every BOX, Hide Settings
  included) to `GRFILM.SET` at the card's root. Load checks the file first (its camera model and every
  record's checksum; a wrong or damaged file changes nothing), then puts the settings back, rewinds
  the rolls and asks to restart the camera. To keep or share settings, copy `GRFILM.SET`; in the
  program, open it (Image Control page, film mode) to check it and write it to the card, alone or with
  the firmware, then load it in the camera.
- **Aspect Ratio menu order** (0.9.7, in the program): 3:2, 1:1 and the added ratios are ordered on
  the Aspect ratio page with the arrows; the camera's menu and the Fn cycle follow that order.
- **Playback** (0.9.4) opens on the last picture taken, whatever the folder (before, it could show
  the roll's last frame after a photo in P).
- **SR by shutter speed** (0.9.4, every GR III / IIIx build): Shake Reduction's list becomes Off,
  1/4000, 1/3200 … 30". With a speed chosen, SR is on at that speed and slower, off when the shutter
  speed is faster. 1/4000 means always on (the factory On, so nothing changes until you choose
  another speed). The speed is kept per BOX like Shake Reduction (and once for P, Av, Tv, M). A
  button set to Shake Reduction turns a speed Off, then back to 1/4000. The SR icon on the shooting
  screen follows the speed (0.9.5): it goes out when the speed is faster than the one chosen.
- The film mode builds on GR Mod's date imprint stage; when the date imprint itself is not
  wanted, its menu line is hidden and nothing is printed on the photos (0.9.2: even when a date
  had been turned on before).

In the program: switch **Film mode** (and **No movie**, **Rear dial off** if wanted) on the GR III / IIIx page, and
give each GR Mod film a 4-character **Film code** (A-Z, 0-9; the folder takes the first three).

## Use it in the browser

**[Open GR Mod Film](https://rollk2.github.io/Ricoh-GRModFilm/)**: nothing to install. The firmware is
built on your computer, in the browser; nothing is sent anywhere.

1. Download your camera's official firmware from Ricoh's site (the dialog of the site links to it) and open
   the `.zip` in the site (no need to unzip it).
2. Choose your settings, as in the program.
3. In Chrome or Edge, « Choose the card… » writes the firmware to the memory card's root (choose the card's
   root folder). In Safari or Firefox, « Download firmware » downloads it: copy it to the card's root.

Your work stays in the browser you use (not in a private window), and the site and the program keep theirs
apart. To move or share it, use the packs: on the Image Control page, the ⋯ menu exports and imports a
**recipe pack** (`.grfrecipes`: each film's names, film code, preset, icon and halation); on the Aspect ratio
page, a **ratio pack** (`.grfratios`). An import asks whether to replace everything or add to what is there.

What the site cannot do (the browser does not allow it): download Ricoh's file itself, list the cards,
move the files already on the card aside, keep firmware copies. The program below does these.

## Install

Download the program for your computer from this repository's
[Releases](https://github.com/rollk2/Ricoh-GRModFilm/releases) page. GR Mod Film keeps its own data
folder, so it can live beside GR Mod. It does not update itself: new versions are published on the
Releases page. Building a firmware and installing it on the camera work as in GR Mod (below). As
with GR Mod, installing a modified firmware is at your own risk; going back to Ricoh's firmware
is always possible.

The development notes (in French) are in `CAHIER_DES_CHARGES.md` and `docs/film-mode-notes.md`.

## Support

GR Mod Film is free. To help it stay free and keep evolving, you can [support GR Mod Film](https://www.paypal.com/qrcodes/managed/1cfe175d-3f48-4649-8a18-f6d8bc6b1e50) (PayPal).
GR Mod Film is built on [GR Mod](https://github.com/Maxwooow/Ricoh-GRMod) by Maxwooow.

## Thanks

None of this would exist without [GR Mod](https://github.com/Maxwooow/Ricoh-GRMod). Maxwooow mapped
the GR III / IIIx firmware, found the addresses, built the tools that patch, check and emulate it,
and wrote the whole desktop program; his first release opened the way. GR Mod Film builds on top of
his work.

---

The rest of this file is GR Mod's own documentation (it also describes the GR IV, which GR Mod Film
does not support).

# GR Mod

Customize your Ricoh GR with your own Image Control presets, aspect ratios, and power-off images—plus additional shooting and display options.

**[Download for Windows, macOS, or Android](https://github.com/Maxwooow/Ricoh-GRMod/releases)** · **[Get the iPhone and iPad app](https://apps.apple.com/app/id6834232648)**

> GR Mod is an independent, open-source project. It is not a Ricoh product.

<p align="center">
  <img src="docs/images/mobile-overview-zh.jpg" width="48%" alt="GR Mod on iPhone, iPad and Android">
  <img src="docs/images/download-guide-zh.jpg" width="48%" alt="Download GR Mod for desktop and Android from GitHub, or for iPhone and iPad from the App Store">
</p>

## Download

| Platform | Download |
| --- | --- |
| Windows | [Latest release](https://github.com/Maxwooow/Ricoh-GRMod/releases) |
| macOS | [Latest release](https://github.com/Maxwooow/Ricoh-GRMod/releases) |
| Android | APK from the [latest release](https://github.com/Maxwooow/Ricoh-GRMod/releases) |
| iPhone and iPad | [App Store: GR Mod - For Ricoh GR IV/III](https://apps.apple.com/app/id6834232648) |
| Linux | [Build from source](#build-from-source); no prebuilt package is currently provided |

See [Releases](https://github.com/Maxwooow/Ricoh-GRMod/releases) for the latest version and release notes.

## Supported cameras and firmware

| Camera | Supported firmware |
| --- | --- |
| GR IV / GR IV HDF | 1.21, 1.20 or 1.11 |
| GR IV Monochrome | 1.11 or 1.10 (the same files as GR IV 1.21 and 1.20) |
| GR III / GR III HDF | 2.21, 2.20 or 2.10 |
| GR IIIx / GR IIIx HDF | 1.71, 1.70 or 1.60 |

Use only firmware intended for your camera model and a base version listed above.

## Features

- **Image Control presets:** add your own looks from `.cube` LUTs or `.xmp` profiles, adjust their parameters, and reorder or hide looks in the camera menu.
- **Aspect ratios:** add custom ratios alongside the camera's factory options.
- **Power-off images:** add your own End Screen pictures and choose between them in the camera.
- **Soft focus and halation:** create softer images and red or white highlight effects.
- **Date imprint:** add a shooting date, date and time, and optionally the Image Control name to JPEGs.
- **Monochrome looks:** use supported GR IV Monochrome looks on colour GR IV models.
- **Black-and-white recipes:** add looks of your own to the GR IV Monochrome from `.cube` LUTs (their tone curve), with their own names, icons and parameters.
- **Direct Flash:** use guide-number-based flash exposure on supported GR IV firmware.
- **HDR gain maps:** create JPEGs with brighter highlights on compatible HDR displays.
- **More ADJ options:** add ADJ lever slots on supported GR IV firmware.
- **Exposure preview and display options:** access additional preview and automatic screen-brightness settings on supported GR IV firmware.

Features vary by camera model and firmware version. The app only offers options supported by the selected firmware.

## Quick start

### Windows and macOS

1. Download and open GR Mod.
2. Select your camera and a supported firmware version.
3. Open your own official Ricoh firmware file, or let GR Mod download it from Ricoh's website.
4. Choose the features and presets you want, then follow the app's instructions to write the modified firmware to a memory card.
5. Install the firmware on the camera using its normal firmware-update process.

**macOS first launch:** unzip `GRMod-mac.zip` and move `GR Mod.app` to Applications. The app is signed ad hoc rather than with an Apple Developer ID. If macOS blocks it, open **System Settings › Privacy & Security** and select **Open Anyway**. Allow access to removable volumes when macOS asks; otherwise, GR Mod cannot write to the memory card.

### Android, iPhone, and iPad

1. Install the app and select your camera and firmware.
2. Choose your customizations.
3. Save the finished firmware to your device, or send it directly to a supported GR IV over Bluetooth and Wi-Fi.

Wireless transfer requires the firmware's base version to match the version currently installed on the camera. See the [mobile guide](mobile/README.md) for platform requirements and transfer details.

## Restore factory firmware

Before returning to the official firmware, reset the camera to factory defaults. Settings created by GR Mod—such as an added look, aspect ratio, or ADJ function—may not be understood by the official firmware.

You can restore the official firmware from the Image Control page or the firmware copies page. After installing a newer official Ricoh firmware, you may not be able to return to an earlier version.

> **Use modified firmware at your own risk.** Check the model and firmware version carefully, keep the camera sufficiently charged, and do not interrupt a firmware update.

## Documentation

- [Mobile app guide](mobile/README.md)
- [Desktop shell guide](shell/README.md)
- [Automatic screen brightness](docs/bright-auto.md)
- [Technical notes and release archive](docs/technical-notes.md)—implementation details, emulator checks, firmware research, and earlier release notes

GR Mod does not include Ricoh firmware. It reads a firmware file supplied by the user or downloads one from Ricoh's official website under Ricoh's licence terms.

## Build from source

From the repository root:

```sh
npm install
npm -w ui run build
cd shell
```

Then build for your platform:

| Command | Output |
| --- | --- |
| `./build.sh windows` | `dist/GRMod.exe` |
| `./build.sh mac` | `dist/GR Mod.app` and `dist/GRMod-mac.zip` |
| `./build.sh linux` | `dist/grmod` (x64) |

On macOS and Linux, GR Mod opens in a supported Chromium-based browser when available, or in the default browser. On Linux, the memory card must be mounted before it appears in the app; the folder picker requires `kdialog` or `zenity`.

### Run tests

```sh
npm -w core test
cd shell
go test ./...
go test -tags desktop ./...
```

Some byte-identity tests require official firmware files in `core/testdata/private/`. Those files are not distributed with this repository.

See the [mobile guide](mobile/README.md) for Android and iOS build instructions.

## Licence and acknowledgements

GR Mod is free software licensed under [GNU GPL version 2 only](LICENSE) (`GPL-2.0-only`).

- The aspect-ratio compiler is based on [DoYitNow/gr-custom-tool](https://github.com/DoYitNow/gr-custom-tool).
- The Monochrome unlock follows the method of [lemonadesaltbagel/GR4-MonoUnlock](https://github.com/lemonadesaltbagel/GR4-MonoUnlock); no code from that project is included.
- The power-off image method builds on public research from [radium-wang/ricoh-gr4-firmware-analysis-and-feature-expansion](https://github.com/radium-wang/ricoh-gr4-firmware-analysis-and-feature-expansion).

The sample image `ui/src/assets/preview.jpg` and Ricoh firmware are not covered by the project's software licence.

## Star History

[![Ricoh-GRMod stars over time](https://api.star-history.com/chart?repos=Maxwooow%2FRicoh-GRMod&type=date&format=svg)](https://www.star-history.com/?repos=Maxwooow%2FRicoh-GRMod&type=date)
