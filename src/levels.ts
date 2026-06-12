import type { LevelConfig, Material, MaterialBag, GameEvent, MaterialType } from './types';

const materialTypeNames: Record<MaterialType, string> = {
  handout: '讲义',
  sticker: '贴纸',
  hint: '提示卡',
  worksheet: '练习题',
  quiz: '测验卷',
  syllabus: '教学大纲'
};



function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createMaterial(
  type: MaterialType,
  course: string,
  targetBagId: string,
  difficulty: number = 1
): Material {
  return {
    id: generateId(),
    type,
    name: `${course}${materialTypeNames[type]}`,
    course,
    targetBagId,
    difficulty
  };
}

function createBag(
  id: string,
  name: string,
  course: string,
  capacity: number,
  color: string,
  icon: string
): MaterialBag {
  return {
    id,
    name,
    course,
    capacity,
    currentCount: 0,
    color,
    icon
  };
}

function createEvent(
  type: GameEvent['type'],
  triggerTime: number,
  description: string,
  options: Partial<GameEvent> = {}
): GameEvent {
  return {
    id: generateId(),
    type,
    triggerTime,
    description,
    ...options
  };
}

export const levels: LevelConfig[] = [
  {
    id: 1,
    name: '入门篇',
    description: '熟悉基本操作，掌握简单的资料分拣',
    duration: 90,
    spawnInterval: 3000,
    unlockScore: 0,
    bags: [
      createBag('bag-yuwen', '语文资料包', '语文', 8, '#e74c3c', '📕'),
      createBag('bag-shuxue', '数学资料包', '数学', 8, '#3498db', '📘')
    ],
    materials: [
      ...Array(6).fill(null).map(() => createMaterial('handout', '语文', 'bag-yuwen', 1)),
      ...Array(6).fill(null).map(() => createMaterial('worksheet', '语文', 'bag-yuwen', 1)),
      ...Array(6).fill(null).map(() => createMaterial('handout', '数学', 'bag-shuxue', 1)),
      ...Array(6).fill(null).map(() => createMaterial('worksheet', '数学', 'bag-shuxue', 1))
    ],
    events: [
      createEvent('capacity_warning', 30, '数学资料包即将装满！', {
        affectedCourse: '数学'
      })
    ]
  },
  {
    id: 2,
    name: '进阶篇',
    description: '三科目混合，注意相似标签不要搞混',
    duration: 120,
    spawnInterval: 2500,
    unlockScore: 60,
    bags: [
      createBag('bag-yuwen', '语文资料包', '语文', 10, '#e74c3c', '📕'),
      createBag('bag-shuxue', '数学资料包', '数学', 10, '#3498db', '📘'),
      createBag('bag-yingyu', '英语资料包', '英语', 10, '#27ae60', '📗')
    ],
    materials: [
      ...Array(5).fill(null).map(() => createMaterial('handout', '语文', 'bag-yuwen', 1)),
      ...Array(5).fill(null).map(() => createMaterial('sticker', '语文', 'bag-yuwen', 2)),
      ...Array(5).fill(null).map(() => createMaterial('hint', '语文', 'bag-yuwen', 1)),
      ...Array(5).fill(null).map(() => createMaterial('handout', '数学', 'bag-shuxue', 1)),
      ...Array(5).fill(null).map(() => createMaterial('worksheet', '数学', 'bag-shuxue', 2)),
      ...Array(5).fill(null).map(() => createMaterial('quiz', '数学', 'bag-shuxue', 2)),
      ...Array(5).fill(null).map(() => createMaterial('handout', '英语', 'bag-yingyu', 1)),
      ...Array(5).fill(null).map(() => createMaterial('syllabus', '英语', 'bag-yingyu', 2))
    ],
    events: [
      createEvent('similar_labels', 25, '⚠️ 出现相似标签资料，请仔细分辨！', {
        duration: 15
      }),
      createEvent('extra_print', 60, '📰 临时加印：新增一批语文资料！', {
        affectedCourse: '语文',
        extraMaterials: [
          ...Array(4).fill(null).map(() => createMaterial('handout', '语文', 'bag-yuwen', 2)),
          ...Array(2).fill(null).map(() => createMaterial('sticker', '语文', 'bag-yuwen', 2))
        ]
      }),
      createEvent('capacity_warning', 90, '英语资料包容量告急！', {
        affectedCourse: '英语'
      })
    ]
  },
  {
    id: 3,
    name: '挑战篇',
    description: '四科目大混战，还有暂停发放的突发情况',
    duration: 150,
    spawnInterval: 2000,
    unlockScore: 150,
    bags: [
      createBag('bag-yuwen', '语文资料包', '语文', 12, '#e74c3c', '📕'),
      createBag('bag-shuxue', '数学资料包', '数学', 12, '#3498db', '📘'),
      createBag('bag-yingyu', '英语资料包', '英语', 12, '#27ae60', '📗'),
      createBag('bag-wuli', '物理资料包', '物理', 12, '#9b59b6', '📙')
    ],
    materials: [
      ...Array(4).fill(null).map(() => createMaterial('handout', '语文', 'bag-yuwen', 2)),
      ...Array(4).fill(null).map(() => createMaterial('sticker', '语文', 'bag-yuwen', 2)),
      ...Array(4).fill(null).map(() => createMaterial('worksheet', '语文', 'bag-yuwen', 2)),
      ...Array(4).fill(null).map(() => createMaterial('handout', '数学', 'bag-shuxue', 2)),
      ...Array(4).fill(null).map(() => createMaterial('quiz', '数学', 'bag-shuxue', 2)),
      ...Array(4).fill(null).map(() => createMaterial('syllabus', '数学', 'bag-shuxue', 2)),
      ...Array(4).fill(null).map(() => createMaterial('handout', '英语', 'bag-yingyu', 2)),
      ...Array(4).fill(null).map(() => createMaterial('hint', '英语', 'bag-yingyu', 2)),
      ...Array(4).fill(null).map(() => createMaterial('worksheet', '英语', 'bag-yingyu', 2)),
      ...Array(4).fill(null).map(() => createMaterial('handout', '物理', 'bag-wuli', 2)),
      ...Array(4).fill(null).map(() => createMaterial('quiz', '物理', 'bag-wuli', 2)),
      ...Array(4).fill(null).map(() => createMaterial('sticker', '物理', 'bag-wuli', 2))
    ],
    events: [
      createEvent('similar_labels', 20, '⚠️ 大量相似资料涌入，注意区分！', {
        duration: 20
      }),
      createEvent('pause_issue', 45, '⏸️ 语文资料暂停发放', {
        affectedCourse: '语文',
        duration: 15
      }),
      createEvent('extra_print', 70, '📰 临时加印：数学和物理各加一批！', {
        extraMaterials: [
          ...Array(3).fill(null).map(() => createMaterial('handout', '数学', 'bag-shuxue', 3)),
          ...Array(3).fill(null).map(() => createMaterial('quiz', '数学', 'bag-shuxue', 3)),
          ...Array(3).fill(null).map(() => createMaterial('worksheet', '物理', 'bag-wuli', 3)),
          ...Array(3).fill(null).map(() => createMaterial('sticker', '物理', 'bag-wuli', 3))
        ]
      }),
      createEvent('pause_issue', 100, '⏸️ 英语资料暂停发放', {
        affectedCourse: '英语',
        duration: 12
      }),
      createEvent('capacity_warning', 120, '物理资料包快满了！', {
        affectedCourse: '物理'
      })
    ]
  },
  {
    id: 4,
    name: '大师篇',
    description: '六科目极限挑战，考验你的手速和判断力',
    duration: 180,
    spawnInterval: 1500,
    unlockScore: 300,
    bags: [
      createBag('bag-yuwen', '语文', '语文', 15, '#e74c3c', '📕'),
      createBag('bag-shuxue', '数学', '数学', 15, '#3498db', '📘'),
      createBag('bag-yingyu', '英语', '英语', 15, '#27ae60', '📗'),
      createBag('bag-wuli', '物理', '物理', 15, '#9b59b6', '📙'),
      createBag('bag-huaxue', '化学', '化学', 15, '#f39c12', '📓'),
      createBag('bag-shengwu', '生物', '生物', 15, '#1abc9c', '📔')
    ],
    materials: [
      ...Array(5).fill(null).map(() => createMaterial('handout', '语文', 'bag-yuwen', 3)),
      ...Array(3).fill(null).map(() => createMaterial('sticker', '语文', 'bag-yuwen', 3)),
      ...Array(3).fill(null).map(() => createMaterial('quiz', '语文', 'bag-yuwen', 3)),
      ...Array(5).fill(null).map(() => createMaterial('handout', '数学', 'bag-shuxue', 3)),
      ...Array(3).fill(null).map(() => createMaterial('worksheet', '数学', 'bag-shuxue', 3)),
      ...Array(3).fill(null).map(() => createMaterial('syllabus', '数学', 'bag-shuxue', 3)),
      ...Array(5).fill(null).map(() => createMaterial('handout', '英语', 'bag-yingyu', 3)),
      ...Array(3).fill(null).map(() => createMaterial('hint', '英语', 'bag-yingyu', 3)),
      ...Array(3).fill(null).map(() => createMaterial('sticker', '英语', 'bag-yingyu', 3)),
      ...Array(5).fill(null).map(() => createMaterial('handout', '物理', 'bag-wuli', 3)),
      ...Array(3).fill(null).map(() => createMaterial('quiz', '物理', 'bag-wuli', 3)),
      ...Array(3).fill(null).map(() => createMaterial('worksheet', '物理', 'bag-wuli', 3)),
      ...Array(5).fill(null).map(() => createMaterial('handout', '化学', 'bag-huaxue', 3)),
      ...Array(3).fill(null).map(() => createMaterial('sticker', '化学', 'bag-huaxue', 3)),
      ...Array(3).fill(null).map(() => createMaterial('hint', '化学', 'bag-huaxue', 3)),
      ...Array(5).fill(null).map(() => createMaterial('handout', '生物', 'bag-shengwu', 3)),
      ...Array(3).fill(null).map(() => createMaterial('worksheet', '生物', 'bag-shengwu', 3)),
      ...Array(3).fill(null).map(() => createMaterial('quiz', '生物', 'bag-shengwu', 3))
    ],
    events: [
      createEvent('similar_labels', 15, '⚠️ 相似标签来袭，提高警惕！', {
        duration: 25
      }),
      createEvent('pause_issue', 40, '⏸️ 数学资料暂停发放', {
        affectedCourse: '数学',
        duration: 18
      }),
      createEvent('extra_print', 65, '📰 加印：化学和生物资料', {
        extraMaterials: [
          ...Array(4).fill(null).map(() => createMaterial('handout', '化学', 'bag-huaxue', 3)),
          ...Array(3).fill(null).map(() => createMaterial('sticker', '化学', 'bag-huaxue', 3)),
          ...Array(4).fill(null).map(() => createMaterial('handout', '生物', 'bag-shengwu', 3)),
          ...Array(3).fill(null).map(() => createMaterial('worksheet', '生物', 'bag-shengwu', 3))
        ]
      }),
      createEvent('similar_labels', 90, '⚠️ 又一批相似资料，稳住！', {
        duration: 20
      }),
      createEvent('pause_issue', 110, '⏸️ 物理和英语资料暂停', {
        duration: 15
      }),
      createEvent('capacity_warning', 130, '多个资料包容量告急！', {}),
      createEvent('extra_print', 150, '📰 最终加印：全部科目各加一份', {
        extraMaterials: [
          createMaterial('handout', '语文', 'bag-yuwen', 3),
          createMaterial('handout', '数学', 'bag-shuxue', 3),
          createMaterial('handout', '英语', 'bag-yingyu', 3),
          createMaterial('handout', '物理', 'bag-wuli', 3),
          createMaterial('handout', '化学', 'bag-huaxue', 3),
          createMaterial('handout', '生物', 'bag-shengwu', 3)
        ]
      })
    ]
  }
];

export function getMaterialTypeName(type: MaterialType): string {
  return materialTypeNames[type];
}

export const courseColors: Record<string, string> = {
  '语文': '#e74c3c',
  '数学': '#3498db',
  '英语': '#27ae60',
  '物理': '#9b59b6',
  '化学': '#f39c12',
  '生物': '#1abc9c'
};
