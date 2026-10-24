// 어두운 역 v4 — 사람이 서는 자리 (화면이 정한다 — 표에는 자리가 없다). 브라우저 전역 DS4.spots + node require 겸용.
// game.js 가 읽고, 서는 칸 검사(v4/test/stand.test.js, P0-E2)가 maps 표와 함께 읽는다.
//
// 지키는 것 (2026-10-24 회의 P0-S3 · U5):
//  1) 같은 단계에 두 사람이 위아래로 붙지 않는다 — 아랫사람의 머리·반응 꼬리표가 윗사람 몸에 겹친다.
//  2) 윗칸에 키 큰 단단한 물건(TALL)이 있는 칸에 서지 않는다 — 48px 몸이 윗칸으로 16px 올라가 물건이 머리에 얹힌 것처럼 보인다(화로 불꽃 = 모자).
//  3) 당신이 옆 칸까지 걸어갈 수 있다(말 걸기·치료). 화로(13,10) 위쪽 칸(13~15,9)과 (16,10)은 판자·화로·담요·의자에 둘러싸인 주머니라
//     (14,10)·(15,10) 으로만 드나든다. (15,10)·(15,11)은 비워 둔다 = 오른쪽 사람에게 가는 길.
//  4) (13,11) = 화로 앞(화로를 조사하러 서는 칸) · (13,12) = 단계가 바뀔 때 당신이 물러서는 칸(FIRE_STAND) — 비워 둔다.
//     은지 아침 자리(옛 18,10)는 의자 둘·담요 둘에 갇혀 있어 옮겼다.
// 2026-10-24 옮긴 것: 아침 동하 (22,11)→(23,11) [마리 (22,10) 바로 아래였다] · 저녁 순례 (12,10)→(14,10) [윗칸 (12,9) 게시판] ·
//   저녁 서하 (14,10)→(14,12) · 저녁 기철 (14,11)→(12,12) [서하 바로 아래였다] · 저녁 마리 (16,10) 그대로.
(function (root) {
  'use strict';
  // 잠자리는 maps.beds 순서 = 담요 순서
  const BED_ORDER = ['soonrye', 'seoha', 'gicheol', 'eunji', 'dongha', 'mari'];
  const MORNING = { soonrye: [10, 10], seoha: [16, 10], gicheol: [20, 10], eunji: [21, 11], dongha: [23, 11], mari: [22, 10] };
  const SPOTS = {
    trace: Object.assign({}, MORNING),
    ration: Object.assign({}, MORNING),
    seat: Object.assign({}, MORNING),
    day: { soonrye: [9, 9], seoha: [14, 3], gicheol: [25, 10], eunji: [2, 5], dongha: [3, 5], mari: [22, 11] },
    // 화로(13,10) 둘레에 앉는다: 왼쪽 둘 · 오른쪽 둘 · 앞(승강장 끝선) 둘. 가운데 (13,11)·(13,12)는 당신 자리
    evening: { dongha: [10, 10], eunji: [11, 10], soonrye: [14, 10], mari: [16, 10], gicheol: [12, 12], seoha: [14, 12] },
  };
  // 화로 앞에서 물러선 칸 = 화로 칸 + [0, 2] (단계가 바뀔 때·원정에서 돌아와 아침을 맞을 때 당신이 서는 칸)
  const FIRE_STAND = [0, 2];
  // D0 낮(첫 만남, 2026-10-24 P0-S5 · 부록 A2): 순례는 화로 왼쪽 (12,10)에 쪼그려 앉아 화로를 본다(장작을 넣는다) — 만난 뒤에도 D0 낮에는 불가를 지킨다.
  //   앉은 자세라 윗칸 게시판이 머리에 얹히지 않는다. 단계 자리표(SPOTS)가 아니다 (서는 칸 검사 대상 밖)
  const FIRST = { soonrye: [12, 10] };
  // D0 낮: 만난 뒤에도 자기 담요(maps.beds 자리)에 앉아 있는 사람 — 마리는 손을 닦아 준 그 자리에 그대로 있다 (만나자마자 낮 자리로 사라지지 않게, 2026-10-24 검증 #5)
  const FIRST_BED = ['mari'];
  // 키 큰 단단한 물건: 그림이 칸 위쪽 절반까지 올라오는 것 (윗칸에 이것이 있으면 그 아래 칸에 서지 않는다).
  // 담요(잠자리)·의자·바닥 흔적은 납작해서 빠진다.
  const TALL = ['fire', 'board', 'crate_food', 'parts_crate', 'office_door', 'chalk_wall', 'stairs_ash', 'speaker', 'repair_rubble', 'lever', 'shelter_box',
    'rubble', 'pharmacy_shutter', 'cistern', 'valve', 'vent_shaft', 'radio', 'radio_cab', 'medkit'];
  const api = { SPOTS, BED_ORDER, FIRE_STAND, TALL, FIRST, FIRST_BED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.DS4 = root.DS4 || {}; root.DS4.spots = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
