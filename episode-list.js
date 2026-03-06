// episode-list.js
// This file exposes a global `EPISODE_LIST` array for the main index to consume.
// Edit this file to add/update episodes. Use `release_at` in ISO 8601 (JST) or a date string.
// Example release_at: "2026-01-18T00:00:00+09:00" (midnight Japan time)

window.EPISODE_LIST = [
  { id:1, title:"<cold sleep>", date:"2025/10/10公開", desc:"大切なメッセージ", src:"https://archive.org/download/cold-room-radio-episode-01-coldsleep/Cold%20Room%20Radio%20-%20Episode%2001%20-%20coldsleep.mp3", release_at: "2025-10-10T00:00:00+09:00" },
  { id:2, title:"<are you ready!?>", date:"2026/01/01公開", desc:"コールドスリープ開始", src:"https://archive.org/download/coldroomradio_ep02_areyouready/coldroomradio_ep02_areyouready.mp3", release_at: "2026-01-01T00:00:00+09:00" },
  { id:3, title:"<echo>", date:"2026/01/11公開", desc:"出会い、響いた部分、なぜか泣いちゃう", src:"https://archive.org/download/coldroomradio_ep03_echo/coldroomradio_ep03_echo.mp3", release_at: "2026-01-11T11:30:00+09:00" },
  { id:4, title:"<red&white>", date:"2026/01/18公開", desc:"粒になって消えた。。。", src:"https://archive.org/download/coldroomradio_ep04_rednwhite/coldroomradio_ep04_rednwhite.mp3", release_at: "2026-01-18T11:30:00+09:00" },
  { id:5, title:"<cosmic level>", date:"2026/01/25公開", desc:"一番って決められる？-Album Edition-", src:"https://archive.org/download/coldroomradio_ep05_cosmiclevel/coldroomradio_ep05_cosmiclevel.mp3", release_at: "2026-01-25T20:00:00+09:00" },
  { id:6, title:"<K(p000003)>", date:"2026/02/01公開", desc:"ココ好きシリーズ ①", src:"https://archive.org/download/coldroomradio_ep06_k/coldroomradio_ep06_k.mp3", release_at: "2026-02-01T18:59:00+09:00" },
  { id:7, title:"<N(p000002)>", date:"2026/02/08公開", desc:"ココ好きシリーズ ②", src:"https://archive.org/download/coldroomradio_ep07_n/coldroomradio_ep07_n.mp3", release_at: "2026-02-08T18:59:00+09:00" },
  { id:8, title:"<A(p000001)>", date:"2026/02/15公開", desc:"ココ好きシリーズ ③", src:"https://archive.org/download/coldroomradio_ep08_a/coldroomradio_ep08_a.mp3", release_at: "2026-02-15T08:59:00+09:00" },
  { id:9, title:"<miracle love>", date:"2026/02/22公開", desc:"一番って決められる？-Song Edition-", src:"https://archive.org/download/coldroomradio_ep09_miraclelove/coldroomradio_ep09_miraclelove.mp3", release_at: "2026-02-22T18:59:00+09:00" },
  { id:10, title:"<natural hello>", date:"2026/03/01公開", desc:"一番って決められる？-Dance Move Edition-", src:"https://archive.org/download/coldroomradio_ep10_naturallove/coldroomradio_ep10_naturallove.mp3", release_at: "2026-03-01T18:59:00+09:00"},
  { id:11, title:"<after memories>", date:"2026/03/08公開", desc:"アフターパンフレットを一緒に見よう！", src:"https://archive.org/download/coldroomradio_ep11_aftermemories/coldroomradio_ep11_aftermemories.mp3", release_at: "2026-03-08T18:59:00+09:00" },
  { id:12, title:"<...>", date:"2026/03/15公開", desc:"", src:"", release_at: "2026-03-15T18:59:00+09:00" },
  { id:13, title:"<...>", date:"2026/03/22公開", desc:"", src:"", release_at: "2026-03-22T18:59:00+09:00" },
  { id:14, title:"<...>", date:"2026/04/01公開", desc:"", src:"", release_at: "2026-04-01T18:59:00+09:00" },
  { id:15, title:"<...>", date:"2026/04/08公開", desc:"", src:"", release_at: "2026-04-08T18:59:00+09:00" },
];
