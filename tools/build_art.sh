#!/bin/sh
# 원본(art_src) → 게임 그림(v3/img) 전부 다시 뽑기. 초상은 64도트×2(tools/chunky.py), 걷기는 칸마다 큰 덩어리만. 크기: 타일 48, 사람 48×72, 크리처 96, 상징 64, 초상 128, 장면 480×270
cd "$(dirname "$0")/.." || exit 1
S=art_src; O=v3/img; P="python tools/sheet.py"
rm -rf $O && mkdir -p $O/cg $O/portraits $O/portraits_hurt $O/walk
$P $S/sheets/people.png $O/sprites player,soonrye,seoha,gicheol,eunji,dongha,mari,eunchae,dohyeon 48 72
$P $S/sheets/creatures.png $O/creatures rats,twomouth,drowned,bonepicker,leeches,moth,lampimp,ghoul,child,conductor,echo,eye 96 96
$P $S/sheets/props.png $O/props drum,board,generator,tank,pump,crate,sack,bed,rubble,turnstile,pillar,grave,bones,corpse,stairsUp,stairsDown,lamp,lever,seat,door,mush,cross,blood,wheel 48 48
$P $S/sheets/dungeon.png $O/props stall,mannequin,hooks,cart,kiosk,tires,valve,sludge,ladder,leakbarrel,ratnest,chaindoor,webs,backpack,shrine,vending,slab,bodybag 48 48
$P $S/sheets/gods.png $O/gods nereh,gurmah,seel,termia,osren,hiska,ho 64 64
$P $S/sheets/tiles.png $O/tiles floor,concourse,wall,edge!,track!,water,shutter,pipe,drainFloor,marketFloor --tiles --size 48
$P $S/sheets/tiles2.png $O/tiles carFloor,carWall!,tunnelWall!,ballast!,puddle,concrete,grate,whiteTile,brick,ash --tiles --size 48
$P $S/sheets/props2.png $O/props radio,medkit,mark,shoes,heel,sneaker,phone,briefcase 48 48
for f in $S/walk/*.png; do python tools/chunky.py walk "$f" "$O/walk/$(basename "$f")" 48 72; done
for f in $S/portraits/*.png; do python tools/chunky.py portrait "$f" "$O/portraits/$(basename "$f")" 128; done
for f in $S/portraits_hurt/*.png; do python tools/chunky.py portrait "$f" "$O/portraits_hurt/$(basename "$f")" 128; done
for f in $S/cg/*.png; do python tools/pixelize.py "$f" "$O/cg/$(basename "$f")" 480 270 >/dev/null; done
python tools/manifest.py
