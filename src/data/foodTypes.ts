export type FoodTypeId = 'dust' | 'sap';

export interface FoodType {
  id: FoodTypeId;
  name: string;
  color: number;
  glowColor: number;
  points: number;
  radius: number;
  description: string;
}

export const foodTypes: Record<FoodTypeId, FoodType> = {
  dust: {
    id: 'dust',
    name: '塵',
    color: 0xccccbb,
    glowColor: 0xeeeecc,
    points: 1,
    radius: 6,
    description: '微細な鉱物粒子。伸長進化の糧。',
  },
  sap: {
    id: 'sap',
    name: '液',
    color: 0xddaa44,
    glowColor: 0xffcc66,
    points: 2,
    radius: 8,
    description: '樹液の雫。跳躍進化の糧。',
  },
};

export const ALL_FOOD_TYPE_IDS: FoodTypeId[] = ['dust', 'sap'];
