export interface DefaultPartConfig {
  type: "part1_1" | "part1_2" | "part2" | "part3";
  order: number;
  displayLabel: string;
  defaultPrepSeconds: number;
  defaultAnswerSeconds: number;
  instructionText: string;
}

export const DEFAULT_PARTS_CONFIG: DefaultPartConfig[] = [
  {
    type: "part1_1",
    order: 1,
    displayLabel: "Part 1.1",
    defaultPrepSeconds: 5,
    defaultAnswerSeconds: 30,
    instructionText:
      "In this part, I am going to ask you three short questions about yourself and your interests. You will have 5 seconds to prepare and 30 seconds to reply to each question. Begin speaking when you hear this sound.",
  },
  {
    type: "part1_2",
    order: 2,
    displayLabel: "Part 1.2",
    defaultPrepSeconds: 5,
    defaultAnswerSeconds: 30,
    instructionText:
      "In this part, you will see two pictures and be asked questions about them. You will have 5 seconds to prepare and 30 seconds to reply to each question. Begin speaking when you hear this sound.",
  },
  {
    type: "part2",
    order: 3,
    displayLabel: "Part 2",
    defaultPrepSeconds: 60,
    defaultAnswerSeconds: 120,
    instructionText:
      "In this part, you will see a picture and three questions about it. You will have 1 minute (60 seconds) to prepare and 2 minutes (120 seconds) to answer all three questions together. Begin speaking when you hear the sound.",
  },
  {
    type: "part3",
    order: 4,
    displayLabel: "Part 3",
    defaultPrepSeconds: 60,
    defaultAnswerSeconds: 120,
    instructionText:
      "In this part, you will be given a topic with points for and against. You will have 1 minute (60 seconds) to prepare your speech, and 2 minutes (120 seconds) to speak about both perspectives and give your own opinion. Begin speaking when you hear the sound.",
  },
];

export const BRAND_COLORS = {
  primary: "#0B4F37", // Haziniy deep emerald green
  primaryHover: "#083B29",
  accent: "#10B981", // Mint green
  accentLight: "#ECFDF5",
  badgeYellow: "#EAB308",
  badgeYellowBg: "#FEF08A",
};
