// episode-list.js
// This file exposes a global `EPISODE_LIST` array for the main index to consume.
// Edit this file to add/update episodes. Use `release_at` in ISO 8601 (JST) or a date string.
// Example release_at: "2026-01-18T00:00:00+09:00" (midnight Japan time)

window.EPISODE_LIST = [
  { id:1, title:"<cold sleep>", date:"2025/10/10公開", desc:"大切なメッセージ", src:"https://dn720703.ca.archive.org/0/items/cold-room-radio-episode-01-coldsleep/Cold%20Room%20Radio%20-%20Episode%2001%20-%20coldsleep.mp3", release_at: "2025-10-10T00:00:00+09:00" },
  { id:2, title:"<are you ready!?>", date:"2026/01/01公開", desc:"コールドスリープ開始", src:"https://dn710400.ca.archive.org/0/items/coldroomradio_ep02_areyouready/coldroomradio_ep02_areyouready.mp3", release_at: "2026-01-01T00:00:00+09:00" },
  { id:3, title:"<echo>", date:"2026/01/11公開", desc:"出会い、響いた部分、なぜか泣いちゃう", src:"https://ia601707.us.archive.org/3/items/coldroomradio_ep03_echo/coldroomradio_ep03_echo.mp3", release_at: "2026-01-11T11:30:00+09:00" },
  { id:4, title:"<red&white>", date:"2026/01/18公開", desc:"粒になって消えた。。。", src:"", release_at: "2026-01-18T11:30:00+09:00" },
  { id:5, title:"<K(p000003)>", date:"2026/02/01公開", desc:"ココ好きシリーズ ①", src:"", release_at: "2026-02-01T11:30:00+09:00" },
  { id:6, title:"<N(p000002)>", date:"2026/02/08公開", desc:"ココ好きシリーズ ②", src:"", release_at: "2026-02-08T11:30:00+09:00" },
  { id:7, title:"<A(p000001)>", date:"2026/02/15公開", desc:"ココ好きシリーズ ③", src:"", release_at: "2026-02-15T11:30:00+09:00" },
  { id:8, title:"<past memories>", date:"", desc:"一番記憶に残っている〇〇", src:"", release_at: null },
  { id:9, title:"<...>", date:"", desc:"", src:"", release_at: null },
  { id:10, title:"<...>", date:"", desc:"", src:"", release_at: null }
];
