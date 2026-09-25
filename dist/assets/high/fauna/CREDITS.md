# High-mode fauna assets

The extra fauna module and the files in this folder are loaded only after the
visitor chooses **High**. Standard mode does not request these files.

## Boatman

- Original anatomical mesh: **MakeHuman hm08 base mesh**.
- Original skeleton and vertex weights: **MakeHuman default rig**.
- Authors: Data Collection AB, Joel Palmius, Jonas Hauquier / MakeHuman Community.
- License: **CC0 1.0 Universal** (explicitly released under CC0 in September 2020;
  the weight file identifies its 2021 CC0 release).
- Sources:
  - https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj
  - https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/rigs/default.mhskel
  - https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/rigs/default_weights.mhw
- Texture: **Old Eurasian Male** by **OnlyTheGhosts**, from MakeHuman's official
  `skins02` CC0 asset pack.
- Texture license and official download:
  - https://static.makehumancommunity.org/assets/assetpacks/skins02.html
  - https://files2.makehumancommunity.org/asset_packs/skins02/skins02_cc0.zip
- License text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

Adaptations for this experience: helper geometry removed; body scaled to 1.83 m;
authored CC0 `male_casualsuit01` shirt and trousers fitted to the body using their original MakeHuman barycentric bindings; sandal soles, straps, short hair and sun hat added; UV mesh triangulated and packed
into `boatman.bin`; four skin influences retained per vertex; original rig joint
positions retained in `boatman.json`; relaxed arm pose and subtle breathing/head
motion added; skin image resized to 1024 px and encoded as WebP. Skin tone is
adjusted in the render material. This is an adapted generic character, not a scan
or representation of a particular Bhitarkanika resident.

The local geometry is approximately 1.40 MB, plus a small rig/contact manifest, the
104 KB skin image, and two optimized clothing maps. No model CDN or external asset request is needed at
runtime.

## Tailored clothing upgrade

The separate collared shirt and trousers are the **male_casualsuit01** system
asset by the **MakeHuman Community** (Data Collection AB, Joel Palmius, Jonas
Hauquier), explicitly released under **CC0 1.0** in September 2020.

- Official license listing: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- Original archive: https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip

The authored collar, garment folds, belt, sleeves and fabric UVs are retained.
Adaptations: barycentric fitting to this character, transfer of the original rig
weights, removal of the hidden body using the author's mask, small thickness
rims on open hems/cuffs, neutralized albedo for region-appropriate role colors,
and 1024 px WebP albedo/normal maps. The outfit's original mesh and texture maps
were downloaded only as preparation inputs; the browser uses the optimized
local files. Arm/leg poses use anatomical joint targets, and posed sole/seat
vertices are fitted to the actual deck/bench heights. Idle animation leaves the
root and planted legs fixed.

## Birds and crocodiles

Detailed bird/crocodile geometry and scale/feather/fabric textures are authored
procedurally for this project in `high-fauna.js`; no third-party wildlife model or
photograph is used. Bird species and markings follow the five species already
represented in the experience: little egret, Brahminy kite, common kingfisher,
white-throated kingfisher, and black-capped kingfisher. Crocodiles represent the
saltwater crocodile. These are enhanced realtime models, not photogrammetric
wildlife scans.
