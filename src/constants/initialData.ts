import { Sentence } from '../types';

export const MOVIE_SETTINGS = {
  movieTitleEn: 'Zootopia 2',
  movieTitleKo: '주토피아 2',
  releaseYear: '2025',
  director: 'Jared Bush, Byron Howard',
  screenplay: 'Jared Bush',
  productionCompany: 'Walt Disney Animation Studios',
  distributionCompany: 'Walt Disney Studios Motion Pictures',
  sceneDescription: '닉과 주디의 잠입수사',
  sceneDescriptionEn: 'Nick and Judy Go Undercover',
  youtubeTitle: 'Nick and Judy Go Undercover 😎🤫',
  youtubeChannel: 'Disneykids',
  youtubeUrl: 'https://www.youtube.com/watch?v=Uvrbh32D_c8',
  videoId: 'Uvrbh32D_c8',
  practiceRangeStart: 45, // seconds (00:45)
  practiceRangeEnd: 130, // seconds (02:10)
  authorName: '강윤진',
  studentId: '2025315486',
  courseName: '인공지능과 영어교육 (ENG3088)',
  university: '성균관대학교 (Sungkyunkwan University)',
};

export const ONE_LINE_CREDIT = `Clip: ${MOVIE_SETTINGS.movieTitleEn} (${MOVIE_SETTINGS.releaseYear}), ${MOVIE_SETTINGS.distributionCompany} / ${MOVIE_SETTINGS.productionCompany} · via YouTube · For educational use only`;

export const EDUCATIONAL_NOTICE_EN =
  'This app was made only for non-commercial English learning in the university course AI and English Language Education (ENG3088, Sungkyunkwan University). The film clip is used only to practice listening and speaking (shadowing). It is not sold, shared for profit, downloaded, or edited. All rights to the film belong to its copyright holders.';

export const EDUCATIONAL_NOTICE_KO =
  '이 앱은 성균관대학교 「인공지능과 영어교육」(ENG3088) 수업의 비영리 영어 학습 목적으로만 제작되었습니다. 영화 장면은 듣기·말하기(쉐도잉) 연습에만 사용하며, 판매·영리적 배포·다운로드·편집을 하지 않습니다. 영화의 모든 권리는 저작권자에게 있습니다.';

export const DEFAULT_SENTENCES: Sentence[] = [
  {
    id: 1,
    speaker: 'Judy',
    text: 'Are you sure this will work?',
    korean: '이 일이 잘 될 거라고 확신해?',
    stress: ['work'],
    start: 51.0,
    end: 52.0,
  },
  {
    id: 2,
    speaker: 'Nick',
    text: "You're the one that said we needed a bust",
    korean: '네가 우리한테 급습이 필요할 거라고 했잖아',
    stress: ['needed', 'bust'],
    start: 53.0,
    end: 54.5,
  },
  {
    id: 3,
    speaker: 'Nick',
    text: 'Just follow my lead, OK?',
    korean: '그냥 나만 믿고 따라와, 알겠지?',
    stress: ['follow', 'lead'],
    start: 54.5,
    end: 56.5,
  },
  {
    id: 4,
    speaker: 'Antony Snootley',
    text: 'This whole area is restricted.',
    korean: '이 전체 구역은 제한되었어.',
    stress: ['restricted'],
    start: 59.0,
    end: 61.0,
  },
  {
    id: 5,
    speaker: 'Nick',
    text: 'I guess we should have thought this through, right, babe?',
    korean: '우리 좀 더 생각하고 행동했어야 했나 봐, 그렇지?',
    stress: ['have', 'thought', 'this', 'through'],
    start: 89.0,
    end: 91.0,
  },
];

export const SHADOWING_STEPS_INFO = [
  {
    step: 1,
    title: 'Listen',
    titleKo: '듣기',
    descEn: 'Text hidden. Just listen 2–3 times to feel the flow.',
    descKo: '자막 없이 소리와 리듬에 귀를 기울이며 2~3회 들어보세요.',
    defaultHideText: true,
  },
  {
    step: 2,
    title: 'Mumble',
    titleKo: '웅얼거리기',
    descEn: 'Text hidden. Quietly whisper along with the sound.',
    descKo: '자막을 보지 않고 작은 소리로 소리와 억양을 따라 웅얼거려보세요.',
    defaultHideText: true,
  },
  {
    step: 3,
    title: 'Read & Shadow',
    titleKo: '보고 따라하기',
    descEn: 'Text shown. Speak aloud together with the clip.',
    descKo: '자막을 보면서 배우와 동시에 또박또박 큰 소리로 말해보세요.',
    defaultHideText: false,
  },
  {
    step: 4,
    title: 'Shadow',
    titleKo: '쉐도잉 완성',
    descEn: 'Text hidden. Speak simultaneously like the actor!',
    descKo: '자막을 가리고 진짜 캐릭터처럼 감정을 실어 동시에 쉐도잉하세요!',
    defaultHideText: true,
  },
];
