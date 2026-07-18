export type Site = {
  id: string;
  name: string;
  url: string;
  description: string;
};

export const SITES: Site[] = [
  {
    id: "callting",
    name: "callting",
    url: "https://callting.vercel.app",
    description: "모닝콜 소개팅하는 사이트",
  },
  {
    id: "bbokbbok",
    name: "bbokbbok",
    url: "https://bbokbbok.vercel.app/",
    description: "뽁뽁이 터뜨리기",
  },
  {
    id: "odijjm",
    name: "odijjm",
    url: "https://odijjm.madcamp-kaist.org/",
    description: "지각러 실시간 위치 어디야!",
  },
  {
    id: "omys",
    name: "omys",
    url: "https://omys.madcamp-kaist.org/",
    description: "오늘의 미스터리 스팟",
  },
];
