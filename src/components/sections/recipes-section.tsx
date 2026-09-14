'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Recipe, RecipeIngredient } from '@/types';
import { Plus, ChefHat, Pencil, Trash2, Search, X, Layers, ImagePlus, ImageIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Предустановленные варианты слоев/секторов
const layerOptions = [
  { value: 'none', label: 'Не указано' },
  { value: 'Нижний слой', label: 'Нижний слой' },
  { value: 'Средний слой', label: 'Средний слой' },
  { value: 'Верхний слой', label: 'Верхний слой' },
  { value: 'Сектор', label: 'Сектор' },
  { value: 'По кругу', label: 'По кругу' },
  { value: 'В центре', label: 'В центре' },
  { value: 'По краям', label: 'По краям' },
];

export function RecipesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    bowlType: '',
    tips: '',
    imageUrl: '',
    ingredients: [{ tobacco: '', brand: '', amount: '', layer: '' }],
  });

  const isManager = user?.role === 'MANAGER';

  useEffect(() => {
    const controller = new AbortController();
    fetchRecipes(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchRecipes = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/recipes', { signal });
      const data = await response.json();
      if (!signal?.aborted) {
        setRecipes(data.recipes || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching recipes:', error);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      instructions: '',
      bowlType: '',
      tips: '',
      imageUrl: '',
      ingredients: [{ tobacco: '', brand: '', amount: '', layer: '' }],
    });
    setEditingRecipe(null);
  };

  const openEditDialog = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormData({
      name: recipe.name,
      description: recipe.description || '',
      instructions: recipe.instructions,
      bowlType: recipe.bowlType || '',
      tips: recipe.tips || '',
      imageUrl: recipe.imageUrl || '',
      ingredients: recipe.ingredients.length > 0
        ? recipe.ingredients.map((ing: RecipeIngredient) => ({
            tobacco: ing.tobacco,
            brand: ing.brand || '',
            amount: ing.amount || '',
            layer: ing.layer || '',
          }))
        : [{ tobacco: '', brand: '', amount: '', layer: '' }],
    });
    setIsDialogOpen(true);
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { tobacco: '', brand: '', amount: '', layer: '' }],
    });
  };

  const removeIngredient = (index: number) => {
    if (formData.ingredients.length > 1) {
      setFormData({
        ...formData,
        ingredients: formData.ingredients.filter((_, i) => i !== index),
      });
    }
  };

  const updateIngredient = (index: number, field: string, value: string) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setFormData({ ...formData, ingredients: newIngredients });
  };

  // Загрузка изображения
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'recipe');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setFormData({ ...formData, imageUrl: data.url });
      toast({
        title: 'Изображение загружено',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при загрузке изображения',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const url = '/api/recipes';
      const method = editingRecipe ? 'PUT' : 'POST';
      const body = editingRecipe
        ? { ...formData, id: editingRecipe.id, userId: user.id }
        : { ...formData, authorId: user.id };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: editingRecipe ? 'Рецепт обновлен' : 'Рецепт создан',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchRecipes();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при сохранении',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Удалить этот рецепт?')) return;

    try {
      const response = await fetch(`/api/recipes?id=${id}&userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast({
        title: 'Удалено',
        description: 'Рецепт удален',
      });
      fetchRecipes();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при удалении',
        variant: 'destructive',
      });
    }
  };

  const filteredRecipes = recipes.filter(
    (recipe) =>
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.ingredients.some(ing => ing.tobacco.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Рецептуры</h3>
          <p className="text-slate-400 text-sm">
            Авторские рецепты от руководства
          </p>
        </div>
        {isManager && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={resetForm}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Новый рецепт
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRecipe ? 'Редактировать рецепт' : 'Создать рецепт'}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Добавьте подробную инструкцию для кальянщиков
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Название *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Название рецепта"
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Тип чаши</Label>
                    <Input
                      value={formData.bowlType}
                      onChange={(e) =>
                        setFormData({ ...formData, bowlType: e.target.value })
                      }
                      placeholder="Turka, Phunnel..."
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Описание</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Краткое описание..."
                    className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                  />
                </div>

                {/* Загрузка изображения */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Изображение</Label>
                  <div className="flex items-center gap-4">
                    {formData.imageUrl ? (
                      <div className="relative">
                        <img
                          src={formData.imageUrl}
                          alt="Recipe"
                          className="w-32 h-32 object-cover rounded-lg border border-slate-600"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData({ ...formData, imageUrl: '' })}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
                        {isUploading ? (
                          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ImagePlus className="w-8 h-8 text-slate-400" />
                        )}
                        <span className="text-xs text-slate-400 mt-1">
                          {isUploading ? 'Загрузка...' : 'Добавить фото'}
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Состав табаков</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addIngredient}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Добавить
                    </Button>
                  </div>
                  {formData.ingredients.map((ing, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <Input
                          placeholder="Табак"
                          value={ing.tobacco}
                          onChange={(e) => updateIngredient(index, 'tobacco', e.target.value)}
                          className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                          required
                        />
                        <Input
                          placeholder="Бренд"
                          value={ing.brand}
                          onChange={(e) => updateIngredient(index, 'brand', e.target.value)}
                          className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                        />
                        <Input
                          placeholder="%"
                          value={ing.amount}
                          onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                          className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                        />
                        <Select
                          value={ing.layer || 'none'}
                          onValueChange={(value) => updateIngredient(index, 'layer', value === 'none' ? '' : value)}
                        >
                          <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500">
                            <SelectValue placeholder="Слой/Сектор" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {layerOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="text-white focus:bg-slate-700"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.ingredients.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIngredient(index)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-slate-500">
                    Выберите слой (забивка слоями) или сектор (забивка секторами) для каждого табака
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Инструкция *</Label>
                  <Textarea
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions: e.target.value })
                    }
                    placeholder="Пошаговая инструкция приготовления..."
                    className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[120px]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Советы</Label>
                  <Textarea
                    value={formData.tips}
                    onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
                    placeholder="Дополнительные рекомендации..."
                    className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                    className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                  >
                    {editingRecipe ? 'Сохранить' : 'Опубликовать'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по рецептам..."
          className="bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500 pl-10"
        />
      </div>

      {/* Recipes grid */}
      {filteredRecipes.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <ChefHat className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Рецепты не найдены</p>
            <p className="text-slate-500 text-sm mt-1">
              {isManager
                ? 'Создайте первый авторский рецепт'
                : 'Руководство пока не добавило рецепты'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer"
              onClick={() => setSelectedRecipe(recipe)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-emerald-500" />
                    {recipe.name}
                  </CardTitle>
                  {isManager && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(recipe)}
                        className="text-slate-400 hover:text-emerald-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(recipe.id)}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {recipe.description && (
                  <CardDescription className="text-slate-400">
                    {recipe.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {recipe.bowlType && (
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {recipe.bowlType}
                      </Badge>
                    )}
                  </div>
                  {recipe.ingredients.length > 0 && (
                    <div className="text-sm text-slate-400">
                      {recipe.ingredients.slice(0, 2).map((ing, i) => (
                        <span key={i}>
                          {ing.tobacco}{ing.amount ? ` (${ing.amount})` : ''}
                          {i < Math.min(recipe.ingredients.length, 2) - 1 ? ', ' : ''}
                        </span>
                      ))}
                      {recipe.ingredients.length > 2 && '...'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog
        open={!!selectedRecipe}
        onOpenChange={() => setSelectedRecipe(null)}
      >
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <ChefHat className="w-6 h-6 text-emerald-500" />
                  {selectedRecipe.name}
                </DialogTitle>
                {selectedRecipe.description && (
                  <p className="text-slate-400">{selectedRecipe.description}</p>
                )}
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {/* Quick info */}
                <div className="flex flex-wrap gap-2">
                  {selectedRecipe.bowlType && (
                    <Badge
                      variant="outline"
                      className="border-slate-600 text-slate-300"
                    >
                      Чаша: {selectedRecipe.bowlType}
                    </Badge>
                  )}
                </div>

                {/* Tobacco ingredients */}
                {selectedRecipe.ingredients.length > 0 && (
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-500" />
                      Состав табаков:
                    </h4>
                    <div className="space-y-2">
                      {selectedRecipe.ingredients.map((ing, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm bg-slate-800/50 p-2 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{ing.tobacco}</span>
                            {ing.brand && (
                              <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                {ing.brand}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                            {ing.layer && (
                              <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                                {ing.layer}
                              </Badge>
                            )}
                            {ing.amount && (
                              <Badge variant="outline" className="text-xs border-slate-600">
                                {ing.amount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div>
                  <h4 className="font-medium text-white mb-2">Инструкция:</h4>
                  <p className="text-slate-300 whitespace-pre-wrap">
                    {selectedRecipe.instructions}
                  </p>
                </div>

                {/* Tips */}
                {selectedRecipe.tips && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <h4 className="font-medium text-emerald-400 mb-2">Советы:</h4>
                    <p className="text-slate-300 whitespace-pre-wrap">
                      {selectedRecipe.tips}
                    </p>
                  </div>
                )}

                <p className="text-xs text-slate-500 pt-4 border-t border-slate-700">
                  Автор: {selectedRecipe.author.name} •{' '}
                  {new Date(selectedRecipe.createdAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
