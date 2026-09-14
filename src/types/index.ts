// Типы для приложения Atlas Hookah

export type Role = 'HOOKAH_MASTER' | 'SENIOR_MASTER' | 'ADMIN' | 'MANAGER';

export type CategoryVisibility = 'ADMIN' | 'MASTER' | 'COMMON';

export type NotificationType = 
  | 'SYSTEM' 
  | 'RECIPE_ADDED' 
  | 'RECIPE_UPDATED' 
  | 'RECIPE_DELETED' 
  | 'MESSAGE' 
  | 'ANNOUNCEMENT'
  | 'KNOWLEDGE_ADDED'
  | 'KNOWLEDGE_UPDATED'
  | 'KNOWLEDGE_DELETED'
  | 'CATEGORY_ADDED'
  | 'CATEGORY_DELETED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  authorId: string;
  recipientId: string | null;
  recipeId: string | null;
  recipeName: string | null;
  knowledgeId: string | null;
  knowledgeTitle: string | null;
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  isReadForUser: boolean;
  author: {
    id: string;
    name: string;
    role: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: Role;
  isApproved: boolean;
  bio: string | null;
  phone: string | null;
  city: string | null;
  branch: string | null;
  birthDate: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MixIngredient {
  id: string;
  mixId: string;
  tobacco: string;
  brand: string | null;
  amount: string | null;
  layer: string | null;
}

export interface Mix {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
  author: User | null;
  ingredients: MixIngredient[];
  likes: { userId: string }[];
  comments: { id: string; content: string; userId: string; createdAt: string; user: User }[];
  _count?: {
    likes: number;
    comments: number;
  };
}

export interface ClientMasterNote {
  id: string;
  clientNoteId: string;
  masterId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNote {
  id: string;
  masterId: string | null;
  clientName: string;
  clientPhone: string | null;
  preferences: string | null;
  personalNotes: string | null;
  publicNotes: string;
  favoriteMix: string | null;
  firstVisitCity: string | null;      // Город первого посещения
  firstVisitBranch: string | null;    // Филиал первого посещения
  isPublic: boolean;
  visitCount: number;
  lastVisit: string | null;
  createdAt: string;
  updatedAt: string;
  master?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  masterNotes?: ClientMasterNote[];
  myNote?: ClientMasterNote;
}

// Категория базы знаний
export interface KnowledgeCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  visibility: CategoryVisibility;
  parentCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
  subcategories?: KnowledgeCategory[];
  articles?: Knowledge[];
  _count?: {
    articles: number;
    subcategories: number;
  };
}

// Статья базы знаний
export interface Knowledge {
  id: string;
  title: string;
  content: string;
  categoryId: string | null;
  visibility: CategoryVisibility;
  imageUrl: string | null;
  authorId: string;
  isOfficial: boolean;
  createdAt: string;
  updatedAt: string;
  author: User;
  category?: KnowledgeCategory | null;
}

// Тип контейнера для калькулятора
export interface ContainerType {
  id: string;
  name: string;
  weight: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  tobacco: string;
  brand: string | null;
  amount: string | null;
  layer: string | null;
}

export interface Recipe {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  bowlType: string | null;
  preparationTime: string | null;
  tips: string | null;
  imageUrl: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: User;
  ingredients: RecipeIngredient[];
}

// Состояние приложения
export type AppSection = 
  | 'dashboard'
  | 'profile'
  | 'my-mixes'
  | 'public-mixes'
  | 'clients'
  | 'knowledge'
  | 'recipes'
  | 'notifications'
  | 'manage-users'
  | 'inventory'
  | 'security';

// Категории табака для калькулятора
export type TobaccoCategory = 'CATEGORY_A' | 'CATEGORY_C' | 'CATEGORY_D';

// Данные формы входа
export interface LoginFormData {
  email: string;
  password: string;
}

// Данные формы регистрации
export interface RegisterFormData {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

// Данные формы микса
export interface MixFormData {
  name: string;
  description: string;
  isPublic: boolean;
  ingredients: { tobacco: string; brand: string; amount: string; layer: string }[];
}

// Данные формы клиента
export interface ClientNoteFormData {
  clientName: string;
  clientPhone: string;
  preferences: string;
  notes: string;
  favoriteMix: string;
  firstVisitCity?: string;
  firstVisitBranch?: string;
}

// Данные формы рецепта
export interface RecipeFormData {
  name: string;
  description: string;
  instructions: string;
  bowlType: string;
  tips: string;
  ingredients: { tobacco: string; brand: string; amount: string; layer: string }[];
}

// Данные формы статьи базы знаний
export interface KnowledgeFormData {
  title: string;
  content: string;
  categoryId: string | null;
  sendNotification?: boolean;
}

// Данные формы категории
export interface KnowledgeCategoryFormData {
  name: string;
  description: string;
  color: string;
  parentCategoryId?: string | null;
  sendNotification?: boolean;
}

// Данные формы уведомления
export interface NotificationFormData {
  title: string;
  content: string;
  type: NotificationType;
  recipientId: string | null;
}
