import { QuestionImageItem } from "@/lib/db/schema";

export interface TemplateQuestion {
  text?: string;
  topic?: string;
  imageUrls?: QuestionImageItem[];
  prepSeconds?: number | null;
  answerSeconds?: number | null;
  forPoints?: string[];
  againstPoints?: string[];
}

export interface TemplatePart {
  type: "part1_1" | "part1_2" | "part2" | "part3";
  questions: TemplateQuestion[];
}

export interface MockTemplate {
  id: string;
  title: string;
  levelLabel: string;
  summary: string;
  /** Pictures shipped with the app that the teacher is expected to replace. */
  usesSamplePictures: boolean;
  parts: TemplatePart[];
}

const SPORT_PICTURES: QuestionImageItem[] = [
  { url: "/sample/sports-outdoor.svg", public_id: "sample_sports_outdoor" },
  { url: "/sample/sports-indoor.svg", public_id: "sample_sports_indoor" },
];

/**
 * Full 8-task exam modelled on the official CEFR Multilevel Speaking mock:
 * Part 1.1 (3 personal questions) -> Part 1.2 (3 questions on one pair of
 * pictures) -> Part 2 (one picture with three linked questions) -> Part 3
 * (a topic with FOR / AGAINST tables).
 */
export const SPORTS_AND_FAILURE_TEMPLATE: MockTemplate = {
  id: "multilevel-standard-1",
  title: "Multilevel Speaking Mock #1 — Standart shablon",
  levelLabel: "B1–C1",
  summary:
    "8 ta topshiriq: Part 1.1 (3 ta savol), Part 1.2 (2 ta rasm + 3 ta savol), Part 2 (1 ta rasm + 3 ta savol), Part 3 (FOR/AGAINST mavzusi).",
  usesSamplePictures: true,
  parts: [
    {
      type: "part1_1",
      questions: [
        { text: "What is your favorite place in your home?" },
        { text: "What do you like to do in your free time?" },
        { text: "How often do you watch TV?" },
      ],
    },
    {
      type: "part1_2",
      questions: [
        {
          text: "What do you see in these pictures?",
          imageUrls: SPORT_PICTURES,
        },
        {
          text: "Which do you think offers a greater variety of exercise options: indoor or outdoor sports?",
          imageUrls: SPORT_PICTURES,
        },
        {
          text: "How can sports be made more accessible to everyone in society?",
          imageUrls: SPORT_PICTURES,
        },
      ],
    },
    {
      type: "part2",
      questions: [
        {
          text: [
            "1. Tell me about the time when you tried to do something but failed.",
            "2. How did this failure impact your life and people around you?",
            "3. Do you think accepting failure is an important part of personal growth?",
          ].join("\n"),
          imageUrls: [
            { url: "/sample/failure-desk.svg", public_id: "sample_failure_desk" },
          ],
        },
      ],
    },
    {
      type: "part3",
      questions: [
        {
          topic: "Increasing the cost of fuel can solve environmental problems.",
          text: "Increasing the cost of fuel can solve environmental problems.",
          forPoints: [
            "Higher cost of fuel discourages driving",
            "It promotes alternative transportation",
            "The revenue can be used for green initiatives",
          ],
          againstPoints: [
            "It can be a burden on low-income families",
            "It has limited effect on certain industries",
            "There is a potential for inefficiency",
          ],
        },
      ],
    },
  ],
};

const NAVIGATION_PICTURES: QuestionImageItem[] = [
  { url: "/sample/paper-map.svg", public_id: "sample_paper_map" },
  { url: "/sample/phone-navigation.svg", public_id: "sample_phone_navigation" },
];

/**
 * Second full 8-task exam: neighbourhood and friends (Part 1.1), paper map vs
 * GPS (Part 1.2), a happy memory (Part 2) and free public transport (Part 3).
 */
export const NAVIGATION_AND_HAPPINESS_TEMPLATE: MockTemplate = {
  id: "multilevel-standard-2",
  title: "Multilevel Speaking Mock #2 — Standart shablon",
  levelLabel: "B1–C1",
  summary:
    "8 ta topshiriq: uy-joy va do'stlar, qog'oz xarita va GPS taqqoslovi, baxtli xotira hamda bepul jamoat transporti mavzusi.",
  usesSamplePictures: true,
  parts: [
    {
      type: "part1_1",
      questions: [
        { text: "Can you describe your neighborhood?" },
        { text: "Tell me about a close friend you have." },
        { text: "What do you usually do at home in the evening?" },
      ],
    },
    {
      type: "part1_2",
      questions: [
        {
          text: "What do you see in these pictures?",
          imageUrls: NAVIGATION_PICTURES,
        },
        {
          text: "What are some advantages of using a paper map instead of GPS?",
          imageUrls: NAVIGATION_PICTURES,
        },
        {
          text: "Why do most people prefer digital navigation today?",
          imageUrls: NAVIGATION_PICTURES,
        },
      ],
    },
    {
      type: "part2",
      questions: [
        {
          text: [
            "1. Tell me about a time when you felt truly happy.",
            "2. How did this experience shape your personal view of life?",
            "3. What are the key factors that contribute to happiness in society?",
          ].join("\n"),
          imageUrls: [
            { url: "/sample/happiness.svg", public_id: "sample_happiness" },
          ],
        },
      ],
    },
    {
      type: "part3",
      questions: [
        {
          topic: "Public transport should be free for everyone.",
          text: "Public transport should be free for everyone.",
          forPoints: [
            "Encourages more people to use eco-friendly transportation",
            "Reduces traffic congestion in cities",
            "Improves access for low-income individuals",
          ],
          againstPoints: [
            "High cost of maintaining public transport systems without fare revenue",
            "Overcrowding and misuse of services",
            "Less incentive to keep services efficient and punctual",
          ],
        },
      ],
    },
  ],
};

export const MOCK_TEMPLATES: MockTemplate[] = [
  SPORTS_AND_FAILURE_TEMPLATE,
  NAVIGATION_AND_HAPPINESS_TEMPLATE,
];

export function findTemplate(id: string): MockTemplate | undefined {
  return MOCK_TEMPLATES.find((template) => template.id === id);
}
