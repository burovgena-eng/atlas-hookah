'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Knowledge, KnowledgeCategory, CategoryVisibility } from '@/types';
import { 
  Plus, 
  BookOpen, 
  Pencil, 
  Trash2, 
  Search, 
  ImagePlus, 
  X, 
  ArrowLeft,
  FolderOpen,
  FileText,
  AlertTriangle,
  Bell,
  ChevronRight,
} from 'lucide-react';

// Цвета для выбора категории
const CATEGORY_COLORS = [
  { value: '#10b981', label: 'Зелёный' },
  { value: '#3b82f6', label: 'Синий' },
  { value: '#8b5cf6', label: 'Фиолетовый' },
  { value: '#f59e0b', label: 'Оранжевый' },
  { value: '#ef4444', label: 'Красный' },
  { value: '#ec4899', label: 'Розовый' },
  { value: '#06b6d4', label: 'Бирюзовый' },
];

const visibilityOptions = [
  { value: 'COMMON', label: 'Общая (для всех)', description: 'Видна всем пользователям' },
  { value: 'ADMIN', label: 'Для администраторов', description: 'Видна только администраторам' },
  { value: 'MASTER', label: 'Для мастеров', description: 'Видна только кальянным мастерам' },
];

// Типы для навигации
type ViewMode = 'categories' | 'category' | 'subcategory' | 'article' | 'search';

interface BreadcrumbItem {
  id: string | null;
  name: string;
  type: 'root' | 'category' | 'subcategory';
}

export function KnowledgeSection() {
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();
  const { toast } = useToast();
  
  // Состояния данных
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [articles, setArticles] = useState<Knowledge[]>([]);
  const [allArticles, setAllArticles] = useState<Knowledge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Состояния навигации
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [currentCategory, setCurrentCategory] = useState<KnowledgeCategory | null>(null);
  const [currentSubcategory, setCurrentSubcategory] = useState<KnowledgeCategory | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Knowledge | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'Категории', type: 'root' }]);
  
  // Состояния поиска
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Knowledge[]>([]);
  
  // Состояния диалогов
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isArticleDialogOpen, setIsArticleDialogOpen] = useState(false);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [isDeleteArticleDialogOpen, setIsDeleteArticleDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KnowledgeCategory | null>(null);
  const [editingArticle, setEditingArticle] = useState<Knowledge | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<KnowledgeCategory | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<Knowledge | null>(null);
  
  // Состояния форм
  const [isUploading, setIsUploading] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#10b981',
    visibility: 'COMMON' as CategoryVisibility,
    sendNotification: false,
  });
  const [articleFormData, setArticleFormData] = useState({
    title: '',
    content: '',
    categoryId: '' as string | null,
    imageUrl: '',
    visibility: 'COMMON' as CategoryVisibility,
    sendNotification: false,
  });
  const [deleteForceCategory, setDeleteForceCategory] = useState(false);
  const [deleteNotifyCategory, setDeleteNotifyCategory] = useState(false);
  const [deleteNotifyArticle, setDeleteNotifyArticle] = useState(false);
  
  const isManager = user?.role === 'MANAGER';

  // Загрузка корневых категорий
  useEffect(() => {
    const controller = new AbortController();
    
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Загружаем категории
        const catResponse = await fetch(
          `/api/knowledge/categories?userId=${user.id}&parentId=null`,
          { signal: controller.signal }
        );
        const catData = await catResponse.json();
        
        if (!controller.signal.aborted) {
          setCategories(catData.categories || []);
        }
        
        // Загружаем все статьи
        const artResponse = await fetch(
          `/api/knowledge?userId=${user.id}`,
          { signal: controller.signal }
        );
        const artData = await artResponse.json();
        
        if (!controller.signal.aborted) {
          setAllArticles(artData.articles || []);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching data:', error);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      controller.abort();
    };
  }, [user]);

  const fetchCategories = async (parentId: string | null = null) => {
    if (!user) return;
    try {
      const url = `/api/knowledge/categories?userId=${user.id}&parentId=${parentId || 'null'}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (parentId === null) {
        setCategories(data.categories || []);
      }
      return data.categories || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  };

  // Загрузить все статьи (используется после создания/удаления/обновления)
  const fetchAllArticles = async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/knowledge');
      const data = await response.json();
      setAllArticles(data.articles || []);
    } catch (error) {
      console.error('Error fetching all articles:', error);
    }
  };

  const fetchArticlesByCategory = async (categoryId: string) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/knowledge?userId=${user.id}&categoryId=${categoryId}`);
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
      setArticles([]);
    }
  };

  const searchArticles = async (query: string) => {
    if (!user || !query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`/api/knowledge?userId=${user.id}&search=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.articles || []);
    } catch (error) {
      console.error('Error searching articles:', error);
      setSearchResults([]);
    }
  };

  // Навигация
  const handleCategoryClick = async (category: KnowledgeCategory) => {
    setIsLoading(true);
    setCurrentCategory(category);
    
    // Загружаем подкатегории
    const subcats = await fetchCategories(category.id);
    
    // Загружаем статьи этой категории
    await fetchArticlesByCategory(category.id);
    
    if (subcats && subcats.length > 0) {
      setViewMode('category');
    } else {
      setViewMode('category');
    }
    
    setBreadcrumbs([
      { id: null, name: 'Категории', type: 'root' },
      { id: category.id, name: category.name, type: 'category' },
    ]);
    
    setIsLoading(false);
  };

  const handleSubcategoryClick = async (subcategory: KnowledgeCategory) => {
    setIsLoading(true);
    setCurrentSubcategory(subcategory);
    
    // Загружаем статьи подкатегории
    await fetchArticlesByCategory(subcategory.id);
    
    setViewMode('subcategory');
    setBreadcrumbs([
      { id: null, name: 'Категории', type: 'root' },
      { id: currentCategory?.id || null, name: currentCategory?.name || '', type: 'category' },
      { id: subcategory.id, name: subcategory.name, type: 'subcategory' },
    ]);
    
    setIsLoading(false);
  };

  const handleArticleClick = (article: Knowledge) => {
    setSelectedArticle(article);
    setViewMode('article');
  };

  const handleBack = () => {
    if (viewMode === 'article') {
      if (currentSubcategory) {
        setViewMode('subcategory');
      } else if (currentCategory) {
        setViewMode('category');
      } else {
        setViewMode('search');
      }
      setSelectedArticle(null);
    } else if (viewMode === 'subcategory') {
      setViewMode('category');
      setCurrentSubcategory(null);
      setBreadcrumbs([
        { id: null, name: 'Категории', type: 'root' },
        { id: currentCategory?.id || null, name: currentCategory?.name || '', type: 'category' },
      ]);
    } else if (viewMode === 'category') {
      setViewMode('categories');
      setCurrentCategory(null);
      setBreadcrumbs([{ id: null, name: 'Категории', type: 'root' }]);
    } else if (viewMode === 'search') {
      setViewMode('categories');
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    if (item.type === 'root') {
      setViewMode('categories');
      setCurrentCategory(null);
      setCurrentSubcategory(null);
      setSelectedArticle(null);
      setBreadcrumbs([{ id: null, name: 'Категории', type: 'root' }]);
    } else if (item.type === 'category' && currentCategory) {
      setViewMode('category');
      setCurrentSubcategory(null);
      setSelectedArticle(null);
      setBreadcrumbs([
        { id: null, name: 'Категории', type: 'root' },
        { id: currentCategory.id, name: currentCategory.name, type: 'category' },
      ]);
    }
  };

  // Обработка поиска
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchArticles(query);
      setViewMode('search');
    } else {
      setSearchResults([]);
      if (viewMode === 'search') {
        setViewMode('categories');
      }
    }
  };

  // Категории - CRUD
  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      color: '#10b981',
      visibility: 'COMMON',
      sendNotification: false,
    });
    setEditingCategory(null);
  };

  const openCreateCategoryDialog = (parentId?: string) => {
    resetCategoryForm();
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: KnowledgeCategory) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      visibility: category.visibility,
      sendNotification: false,
    });
    setIsCategoryDialogOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const parentId = currentCategory?.id || null;
      
      if (editingCategory) {
        // Обновление
        const response = await fetch('/api/knowledge/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingCategory.id,
            ...categoryFormData,
            userId: user.id,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        toast({ title: 'Категория обновлена' });
      } else {
        // Создание
        const response = await fetch('/api/knowledge/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...categoryFormData,
            parentCategoryId: parentId,
            authorId: user.id,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        toast({ title: 'Категория создана' });
        
        // Обновляем бейдж уведомлений
        if (categoryFormData.sendNotification) {
          refreshUnreadCount();
        }
      }

      setIsCategoryDialogOpen(false);
      resetCategoryForm();
      
      // Обновляем список категорий
      if (viewMode === 'categories') {
        fetchCategories();
      } else if (viewMode === 'category' && currentCategory) {
        fetchCategories(currentCategory.id);
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при сохранении',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!user || !deletingCategory) return;

    try {
      const response = await fetch('/api/knowledge/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deletingCategory.id,
          userId: user.id,
          forceDelete: deleteForceCategory,
          sendNotification: deleteNotifyCategory,
          authorId: user.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({ title: 'Категория удалена' });
      
      // Обновляем бейдж уведомлений
      if (deleteNotifyCategory) {
        refreshUnreadCount();
      }

      setIsDeleteCategoryDialogOpen(false);
      setDeletingCategory(null);
      setDeleteForceCategory(false);
      setDeleteNotifyCategory(false);
      
      // Обновляем списки
      fetchCategories();
      fetchAllArticles();
      
      if (viewMode === 'category' && currentCategory?.id === deletingCategory.id) {
        handleBack();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при удалении',
        variant: 'destructive',
      });
    }
  };

  // Статьи - CRUD
  const resetArticleForm = () => {
    setArticleFormData({
      title: '',
      content: '',
      categoryId: null,
      imageUrl: '',
      visibility: 'COMMON',
      sendNotification: false,
    });
    setEditingArticle(null);
  };

  const openCreateArticleDialog = () => {
    resetArticleForm();
    // Автоматически выбираем текущую категорию/подкатегорию
    const defaultCategoryId = currentSubcategory?.id || currentCategory?.id || null;
    setArticleFormData(prev => ({
      ...prev,
      categoryId: defaultCategoryId,
    }));
    setIsArticleDialogOpen(true);
  };

  const openEditArticleDialog = (article: Knowledge) => {
    setEditingArticle(article);
    setArticleFormData({
      title: article.title,
      content: article.content,
      categoryId: article.categoryId,
      imageUrl: article.imageUrl || '',
      visibility: article.visibility,
      sendNotification: false,
    });
    setIsArticleDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'knowledge');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setArticleFormData({ ...articleFormData, imageUrl: data.url });
      toast({ title: 'Изображение загружено' });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при загрузке',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleArticleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingArticle) {
        // Обновление
        const response = await fetch('/api/knowledge', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingArticle.id,
            ...articleFormData,
            userId: user.id,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        toast({ title: 'Статья обновлена' });
      } else {
        // Создание
        const response = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...articleFormData,
            authorId: user.id,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        toast({ title: 'Статья создана' });
        
        // Обновляем бейдж уведомлений
        if (articleFormData.sendNotification) {
          refreshUnreadCount();
        }
      }

      setIsArticleDialogOpen(false);
      resetArticleForm();
      
      // Обновляем статьи
      if (viewMode === 'search') {
        searchArticles(searchQuery);
      } else {
        const categoryId = currentSubcategory?.id || currentCategory?.id;
        if (categoryId) {
          fetchArticlesByCategory(categoryId);
        }
      }
      fetchAllArticles();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при сохранении',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteArticle = async () => {
    if (!user || !deletingArticle) return;

    try {
      const response = await fetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deletingArticle.id,
          userId: user.id,
          sendNotification: deleteNotifyArticle,
          authorId: user.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({ title: 'Статья удалена' });
      
      // Обновляем бейдж уведомлений
      if (deleteNotifyArticle) {
        refreshUnreadCount();
      }

      setIsDeleteArticleDialogOpen(false);
      setDeletingArticle(null);
      setDeleteNotifyArticle(false);
      
      // Обновляем списки
      if (viewMode === 'search') {
        searchArticles(searchQuery);
      } else {
        const categoryId = currentSubcategory?.id || currentCategory?.id;
        if (categoryId) {
          fetchArticlesByCategory(categoryId);
        }
      }
      fetchAllArticles();
      
      if (selectedArticle?.id === deletingArticle.id) {
        handleBack();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при удалении',
        variant: 'destructive',
      });
    }
  };

  // Получить все категории и подкатегории для селекта
  const getAllCategoriesForSelect = (): { value: string; label: string; category?: KnowledgeCategory }[] => {
    const result: { value: string; label: string; category?: KnowledgeCategory }[] = [];
    
    categories.forEach(cat => {
      result.push({ value: cat.id, label: cat.name, category: cat });
      // Добавляем подкатегории с отступом
      if (cat.subcategories) {
        cat.subcategories.forEach(sub => {
          result.push({ value: sub.id, label: `  └ ${sub.name}`, category: sub });
        });
      }
    });
    
    return result;
  };

  const getVisibilityLabel = (visibility: CategoryVisibility | null | undefined) => {
    if (!visibility) return 'Общая';
    const opt = visibilityOptions.find((v) => v.value === visibility);
    return opt?.label || visibility;
  };

  // Рендер компонентов
  if (isLoading && viewMode === 'categories' && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Рендер главного экрана с категориями
  const renderCategoriesView = () => (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">База знаний</h3>
          <p className="text-slate-400 text-sm hidden sm:block">
            Полезная информация для кальянных мастеров
          </p>
        </div>
        {isManager && (
          <Button
            onClick={() => openCreateCategoryDialog()}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white touch-manipulation w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить категорию
          </Button>
        )}
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Поиск по всем статьям..."
          className="bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500 pl-10"
        />
      </div>

      {/* Результаты поиска */}
      {viewMode === 'search' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">
              Найдено: {searchResults.length} статей
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setViewMode('categories');
              }}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4 mr-1" />
              Очистить
            </Button>
          </div>
          {searchResults.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6 text-center">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Ничего не найдено</p>
              </CardContent>
            </Card>
          ) : (
            renderArticlesGrid(searchResults)
          )}
        </div>
      )}

      {/* Карточки категорий */}
      {viewMode === 'categories' && (
        <>
          {categories.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6 lg:p-8 text-center">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Категории не созданы</p>
                {isManager && (
                  <Button
                    onClick={() => openCreateCategoryDialog()}
                    variant="outline"
                    className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Создать категорию
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
              {categories.map((category) => (
                <Card
                  key={category.id}
                  className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all cursor-pointer group relative overflow-hidden"
                  onClick={() => handleCategoryClick(category)}
                >
                  {/* Цветной акцент слева */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: category.color }}
                  />
                  
                  <CardHeader className="pb-2 p-4 pl-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-white text-base lg:text-lg flex items-center gap-2">
                          <FolderOpen 
                            className="w-5 h-5 flex-shrink-0"
                            style={{ color: category.color }}
                          />
                          <span className="truncate">{category.name}</span>
                        </CardTitle>
                        {category.description && (
                          <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                            {category.description}
                          </p>
                        )}
                      </div>
                      
                      {/* Действия для MANAGER */}
                      {isManager && (
                        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCategoryDialog(category);
                            }}
                            className="text-slate-400 hover:text-emerald-500 h-8 w-8 p-0"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingCategory(category);
                              setIsDeleteCategoryDialogOpen(true);
                            }}
                            className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {category._count?.articles || 0} статей
                      </span>
                      {(category._count?.subcategories || 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <FolderOpen className="w-4 h-4" />
                          {category._count?.subcategories} подкатегорий
                        </span>
                      )}
                    </div>
                  </CardContent>
                  
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-hover:text-emerald-500 transition-colors" />
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Рендер содержимого категории
  const renderCategoryView = () => {
    const subcategories = categories.find(c => c.id === currentCategory?.id)?.subcategories || [];
    
    return (
      <div className="space-y-4 lg:space-y-6">
        {/* Header с навигацией */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-slate-400 hover:text-white touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Назад
            </Button>
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: currentCategory?.color + '20' }}
            >
              <FolderOpen 
                className="w-5 h-5"
                style={{ color: currentCategory?.color }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{currentCategory?.name}</h3>
              {currentCategory?.description && (
                <p className="text-slate-400 text-sm">{currentCategory.description}</p>
              )}
            </div>
          </div>
          
          {isManager && (
            <div className="flex gap-2">
              <Button
                onClick={() => openCreateCategoryDialog()}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 touch-manipulation"
              >
                <Plus className="w-4 h-4 mr-2" />
                Подкатегория
              </Button>
              <Button
                onClick={openCreateArticleDialog}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white touch-manipulation"
              >
                <Plus className="w-4 h-4 mr-2" />
                Статья
              </Button>
            </div>
          )}
        </div>

        {/* Подкатегории */}
        {subcategories.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-400">Подкатегории</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subcategories.map((sub) => (
                <Card
                  key={sub.id}
                  className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all cursor-pointer group relative overflow-hidden"
                  onClick={() => handleSubcategoryClick(sub)}
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: sub.color }
                    }
                  />
                  
                  <CardContent className="p-4 pl-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen 
                          className="w-4 h-4"
                          style={{ color: sub.color }}
                        />
                        <span className="text-white font-medium">{sub.name}</span>
                      </div>
                      
                      {isManager && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCategoryDialog(sub);
                            }}
                            className="text-slate-400 hover:text-emerald-500 h-7 w-7 p-0"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingCategory(sub);
                              setIsDeleteCategoryDialogOpen(true);
                            }}
                            className="text-slate-400 hover:text-red-400 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                      <span>{sub._count?.articles || 0} статей</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Статьи категории */}
        {articles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-400">Статьи</h4>
            {renderArticlesGrid(articles)}
          </div>
        )}

        {subcategories.length === 0 && articles.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6 text-center">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">В этой категории пока нет статей</p>
              {isManager && (
                <Button
                  onClick={openCreateArticleDialog}
                  variant="outline"
                  className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Создать статью
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Рендер содержимого подкатегории
  const renderSubcategoryView = () => (
    <div className="space-y-4 lg:space-y-6">
      {/* Header с навигацией */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-slate-400 hover:text-white touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Назад
          </Button>
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: currentSubcategory?.color + '20' }}
          >
            <FolderOpen 
              className="w-5 h-5"
              style={{ color: currentSubcategory?.color }}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{currentSubcategory?.name}</h3>
            {currentSubcategory?.description && (
              <p className="text-slate-400 text-sm">{currentSubcategory.description}</p>
            )}
          </div>
        </div>
        
        {isManager && (
          <Button
            onClick={openCreateArticleDialog}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white touch-manipulation"
          >
            <Plus className="w-4 h-4 mr-2" />
            Статья
          </Button>
        )}
      </div>

      {/* Статьи подкатегории */}
      {articles.length > 0 ? (
        renderArticlesGrid(articles)
      ) : (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">В этой подкатегории пока нет статей</p>
            {isManager && (
              <Button
                onClick={openCreateArticleDialog}
                variant="outline"
                className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Создать статью
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Рендер просмотра статьи
  const renderArticleView = () => {
    if (!selectedArticle) return null;
    
    return (
      <div className="space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-slate-400 hover:text-white touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Назад
          </Button>
          
          {isManager && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditArticleDialog(selectedArticle)}
                className="text-slate-400 hover:text-emerald-500"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Редактировать
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeletingArticle(selectedArticle);
                  setIsDeleteArticleDialogOpen(true);
                }}
                className="text-slate-400 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Удалить
              </Button>
            </div>
          )}
        </div>

        {/* Статья */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="p-4 lg:p-6">
            <div className="flex items-start gap-3">
              {selectedArticle.category && (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: selectedArticle.category.color + '20' }}
                >
                  <FolderOpen 
                    className="w-5 h-5"
                    style={{ color: selectedArticle.category.color }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl lg:text-2xl text-white mb-2">
                  {selectedArticle.title}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  {selectedArticle.category && (
                    <Badge 
                      variant="outline" 
                      className="border-slate-600 text-slate-300"
                      style={{ borderColor: selectedArticle.category.color }}
                    >
                      {selectedArticle.category.name}
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {getVisibilityLabel(selectedArticle.visibility)}
                  </Badge>
                  <span>•</span>
                  <span>{selectedArticle.author.name}</span>
                  <span>•</span>
                  <span>{new Date(selectedArticle.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 lg:p-6 pt-0">
            {selectedArticle.imageUrl && (
              <img 
                src={selectedArticle.imageUrl} 
                alt={selectedArticle.title}
                className="w-full max-h-96 object-cover rounded-lg mb-6"
              />
            )}
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 whitespace-pre-wrap">{selectedArticle.content}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Рендер сетки статей
  const renderArticlesGrid = (articlesList: Knowledge[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
      {articlesList.map((article) => (
        <Card
          key={article.id}
          className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer group"
          onClick={() => handleArticleClick(article)}
        >
          <CardHeader className="pb-2 p-3 lg:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-white text-base lg:text-lg flex items-center gap-2 truncate">
                  <span className="truncate">{article.title}</span>
                </CardTitle>
                {article.category && (
                  <Badge 
                    variant="outline" 
                    className="mt-1 text-xs border-slate-600"
                    style={{ borderColor: article.category.color, color: article.category.color }}
                  >
                    {article.category.name}
                  </Badge>
                )}
              </div>
              {isManager && (
                <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditArticleDialog(article);
                    }}
                    className="text-slate-400 hover:text-emerald-500 h-8 w-8 p-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingArticle(article);
                      setIsDeleteArticleDialogOpen(true);
                    }}
                    className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 lg:p-4 pt-0">
            {article.imageUrl && (
              <img 
                src={article.imageUrl} 
                alt={article.title}
                className="w-full h-32 object-cover rounded-lg mb-3"
              />
            )}
            <p className="text-slate-400 text-xs sm:text-sm line-clamp-3">
              {article.content}
            </p>
            <p className="text-slate-500 text-[10px] sm:text-xs mt-3">
              {article.author.name} • {new Date(article.createdAt).toLocaleDateString('ru-RU')}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <>
      {/* Main Content */}
      {viewMode === 'categories' && renderCategoriesView()}
      {viewMode === 'category' && renderCategoryView()}
      {viewMode === 'subcategory' && renderSubcategoryView()}
      {viewMode === 'article' && renderArticleView()}
      {viewMode === 'search' && renderCategoriesView()}

      {/* Диалог создания/редактирования категории */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingCategory 
                ? 'Измените параметры категории' 
                : 'Создайте новую категорию для статей'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Название *</Label>
              <Input
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                placeholder="Название категории"
                className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Описание</Label>
              <Textarea
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                placeholder="Краткое описание (опционально)"
                className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Цвет</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setCategoryFormData({ ...categoryFormData, color: color.value })}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      categoryFormData.color === color.value 
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' 
                        : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Видимость</Label>
              <Select
                value={categoryFormData.visibility}
                onValueChange={(value) => setCategoryFormData({ ...categoryFormData, visibility: value as CategoryVisibility })}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {visibilityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-slate-700">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editingCategory && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="category-notify"
                  checked={categoryFormData.sendNotification}
                  onCheckedChange={(checked) => 
                    setCategoryFormData({ ...categoryFormData, sendNotification: checked === true })
                  }
                />
                <label 
                  htmlFor="category-notify" 
                  className="text-sm text-slate-300 flex items-center gap-2 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  Отправить уведомление всем сотрудникам
                </label>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsCategoryDialogOpen(false); resetCategoryForm(); }}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
              >
                {editingCategory ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог создания/редактирования статьи */}
      <Dialog open={isArticleDialogOpen} onOpenChange={setIsArticleDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw]">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? 'Редактировать статью' : 'Новая статья'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingArticle ? 'Измените содержимое статьи' : 'Создайте новую статью'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleArticleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Заголовок *</Label>
              <Input
                value={articleFormData.title}
                onChange={(e) => setArticleFormData({ ...articleFormData, title: e.target.value })}
                placeholder="Название статьи"
                className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Категория</Label>
                <Select
                  value={articleFormData.categoryId || ''}
                  onValueChange={(value) => setArticleFormData({ ...articleFormData, categoryId: value || null })}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                    <SelectValue placeholder="Без категории" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="" className="text-white focus:bg-slate-700">
                      Без категории
                    </SelectItem>
                    {getAllCategoriesForSelect().map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="text-white focus:bg-slate-700">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Видимость</Label>
                <Select
                  value={articleFormData.visibility}
                  onValueChange={(value) => setArticleFormData({ ...articleFormData, visibility: value as CategoryVisibility })}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {visibilityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-slate-700">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-slate-300">Изображение</Label>
              <div className="flex items-center gap-3">
                {articleFormData.imageUrl ? (
                  <div className="relative">
                    <img
                      src={articleFormData.imageUrl}
                      alt="Article"
                      className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-slate-600"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setArticleFormData({ ...articleFormData, imageUrl: '' })}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
                    {isUploading ? (
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ImagePlus className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                    )}
                    <span className="text-[10px] sm:text-xs text-slate-400 mt-1">
                      {isUploading ? 'Загрузка...' : 'Фото'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Содержание *</Label>
              <Textarea
                value={articleFormData.content}
                onChange={(e) => setArticleFormData({ ...articleFormData, content: e.target.value })}
                placeholder="Основной текст статьи..."
                className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[150px]"
                required
              />
            </div>

            {!editingArticle && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="article-notify"
                  checked={articleFormData.sendNotification}
                  onCheckedChange={(checked) => 
                    setArticleFormData({ ...articleFormData, sendNotification: checked === true })
                  }
                />
                <label 
                  htmlFor="article-notify" 
                  className="text-sm text-slate-300 flex items-center gap-2 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  Отправить уведомление всем сотрудникам
                </label>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsArticleDialogOpen(false); resetArticleForm(); }}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
              >
                {editingArticle ? 'Сохранить' : 'Опубликовать'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления категории */}
      <AlertDialog open={isDeleteCategoryDialogOpen} onOpenChange={setIsDeleteCategoryDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Удалить категорию?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {deletingCategory?._count?.articles || deletingCategory?._count?.subcategories || 0 > 0 ? (
                <span>
                  Категория «{deletingCategory?.name}» содержит {deletingCategory?._count?.articles || 0} статей 
                  и {deletingCategory?._count?.subcategories || 0} подкатегорий.
                </span>
              ) : (
                <span>
                  Вы уверены, что хотите удалить категорию «{deletingCategory?.name}»?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {(deletingCategory?._count?.articles || 0) > 0 || (deletingCategory?._count?.subcategories || 0) > 0 ? (
            <div className="space-y-3 py-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="force-delete"
                  checked={deleteForceCategory}
                  onCheckedChange={(checked) => setDeleteForceCategory(checked === true)}
                />
                <label htmlFor="force-delete" className="text-sm text-slate-300 cursor-pointer">
                  Удалить вместе со всем содержимым
                </label>
              </div>
            </div>
          ) : null}

          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="delete-category-notify"
              checked={deleteNotifyCategory}
              onCheckedChange={(checked) => setDeleteNotifyCategory(checked === true)}
            />
            <label htmlFor="delete-category-notify" className="text-sm text-slate-300 flex items-center gap-2 cursor-pointer">
              <Bell className="w-4 h-4" />
              Отправить уведомление всем сотрудникам
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={
                ((deletingCategory?._count?.articles || 0) > 0 || (deletingCategory?._count?.subcategories || 0) > 0) 
                && !deleteForceCategory
              }
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог подтверждения удаления статьи */}
      <AlertDialog open={isDeleteArticleDialogOpen} onOpenChange={setIsDeleteArticleDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Удалить статью?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Вы уверены, что хотите удалить статью «{deletingArticle?.title}»?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="delete-article-notify"
              checked={deleteNotifyArticle}
              onCheckedChange={(checked) => setDeleteNotifyArticle(checked === true)}
            />
            <label htmlFor="delete-article-notify" className="text-sm text-slate-300 flex items-center gap-2 cursor-pointer">
              <Bell className="w-4 h-4" />
              Отправить уведомление всем сотрудникам
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteArticle}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile FAB */}
      {isManager && viewMode !== 'article' && viewMode !== 'search' && (
        <div className="fixed bottom-20 right-4 lg:hidden z-30">
          <Button
            onClick={() => {
              if (viewMode === 'categories') {
                openCreateCategoryDialog();
              } else {
                openCreateArticleDialog();
              }
            }}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30 touch-manipulation active:scale-95"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
    </>
  );
}
