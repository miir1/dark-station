#!/bin/sh
# 설계 v5: 타일 32·사람 32×48·초상 96·크리처 128·장면 384×216, 외곽선은 그 그림의 어두운 색.
# 원본(art_src) → 게임 그림(v3/img) 전부 다시 뽑기. 초상은 64도트×2(tools/chunky.py), 걷기는 칸마다 큰 덩어리만. 크기: 타일 48, 사람 48×72, 크리처 96, 상징 64, 초상 128, 장면 480×270
cd "$(dirname "$0")/.." || exit 1
S=art_src; O=v3/img; P="python tools/sheet.py"
rm -rf $O && mkdir -p $O/cg $O/portraits $O/portraits_hurt $O/walk
$P $S/sheets/people.png $O/sprites player,soonrye,seoha,gicheol,eunji,dongha,mari,eunchae,dohyeon 32 48
$P $S/sheets/creatures.png $O/creatures rats,twomouth,drowned,bonepicker,leeches,moth,lampimp,ghoul,child,conductor,echo,eye 128 128
$P $S/sheets/props.png $O/props drum,board,generator,tank,pump,crate,sack:24x24,bed,rubble,turnstile,pillar:32x64,grave:24x28,bones:24x20,corpse,stairsUp,stairsDown,lamp:20x24,lever:20x28,seat,door:32x64,mush:24x20,cross:24x24,blood,wheel:24x24 32 32
$P $S/sheets/dungeon.png $O/props stall,mannequin:28x44,hooks,cart,kiosk:32x48,tires,valve:24x24,sludge,ladder:24x44,leakbarrel:24x28,ratnest,chaindoor:32x48,webs,backpack:20x24,shrine,vending:32x48,slab,bodybag 32 32
$P $S/sheets/gods.png $O/gods nereh,gurmah,seel,termia,osren,hiska,ho 64 64
python tools/icons.py $S/icons/sheet1.png food,water,parts,meds,power,flood,exposure,stress,injury,trust,obs,str,tech,talk,day >/dev/null
python tools/icons.py $S/icons/sheet2.png train,people,gods,log,sound,restart,board,rest,forage,pump,salvage,gen,drain,guard,build >/dev/null
$P $S/sheets/tiles.png $O/tiles floor,concourse,wall,edge!,track!,water,shutter,pipe,drainFloor,marketFloor --tiles --size 32
$P $S/sheets/tiles2.png $O/tiles carFloor,carWall!,tunnelWall!,ballast!,puddle,concrete,grate,whiteTile,brick,ash --tiles --size 32
$P $S/sheets/props2.png $O/props radio:20x24,medkit:20x20,mark:16x28,shoes:20x16,heel:16x16,sneaker:18x14,phone:14x18,briefcase:22x18 32 32
for f in $S/walk/*.png; do python tools/chunky.py walk "$f" "$O/walk/$(basename "$f")" 32 48; done
for f in $S/portraits/*.png; do python tools/chunky.py portrait "$f" "$O/portraits/$(basename "$f")" 96; done
for f in $S/portraits_hurt/*.png; do python tools/chunky.py portrait "$f" "$O/portraits_hurt/$(basename "$f")" 96; done
for f in $S/cg/*.png; do python tools/chunky.py cg "$f" "$O/cg/$(basename "$f")" 384 216 >/dev/null; done
python tools/manifest.py
