'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mix, MixIngredient } from '@/types';
import { Plus, Pencil, Trash2, Beaker, X, Heart, Layers, GripVertical } from 'lucide-react';

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

export function MyMixesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMix, setEditingMix] = useState<Mix | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
    ingredients: [{ tobacco: '', brand: '', amount: '', layer: '' }],
  });

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchMixes = async () => {
      if (!user) return;

      try {
        const response = await fetch(`/api/mixes?userId=${user.id}&type=personal`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!controller.signal.aborted) {
          setMixes(data.mixes || []);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching mixes:', error);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchMixes();
    
    return () => {
      controller.abort();
    };
  }, [user]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isPublic: false,
      ingredients: [{ tobacco: '', brand: '', amount: '', layer: '' }],
    });
    setEditingMix(null);
  };

  const openEditDialog = (mix: Mix) => {
    setEditingMix(mix);
    setFormData({
      name: mix.name,
      description: mix.description || '',
      isPublic: mix.isPublic,
      ingredients: mix.ingredients.length > 0
        ? mix.ingredients.map((ing: MixIngredient) => ({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const url = '/api/mixes';
      const method = editingMix ? 'PUT' : 'POST';
      const body = editingMix
        ? { ...formData, id: editingMix.id, userId: user.id }
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
        title: editingMix ? 'Микс обновлен' : 'Микс создан',
        description: editingMix
          ? 'Изменения сохранены'
          : formData.isPublic
          ? 'Микс опубликован для всех'
          : 'Микс добавлен в личную коллекцию',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchMixes();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при сохранении',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Удалить этот микс?')) return;

    try {
      const response = await fetch(`/api/mixes?id=${id}&userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast({
        title: 'Удалено',
        description: 'Микс удален',
      });
      fetchMixes();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Ошибка при удалении',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Мои миксы</h3>
          <p className="text-slate-400 text-sm hidden sm:block">
            Создавайте и храните свои уникальные миксы табаков
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white touch-manipulation w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Новый микс
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-lg">{editingMix ? 'Редактировать микс' : 'Создать микс'}</DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                Добавьте табаки и пропорции для вашего микса
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Название микса</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Ледяной тропик"
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Описание</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Опишите вкус и особенности..."
                  className="bg-slate-900/50 border-slate-600 text-white focus:border-emerald-500 min-h-[80px]"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-sm">Ингредиенты</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addIngredient}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 touch-manipulation"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Добавить
                  </Button>
                </div>
                
                {/* Mobile-optimized ingredients list */}
                <div className="space-y-3">
                  {formData.ingredients.map((ing, index) => (
                    <div key={index} className="bg-slate-900/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Ингредиент {index + 1}</span>
                        {formData.ingredients.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredient(index)}
                            className="text-slate-400 hover:text-red-400 h-7 w-7 p-0 touch-manipulation"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Mobile: stacked layout */}
                      <div className="grid grid-cols-2 gap-2 sm:hidden">
                        <Input
                          placeholder="Табак *"
                          value={ing.tobacco}
                          onChange={(e) => updateIngredient(index, 'tobacco', e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white text-sm"
                          required
                        />
                        <Input
                          placeholder="Бренд"
                          value={ing.brand}
                          onChange={(e) => updateIngredient(index, 'brand', e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white text-sm"
                        />
                        <Input
                          placeholder="Количество %"
                          value={ing.amount}
                          onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white text-sm"
                        />
                        <Select
                          value={ing.layer || 'none'}
                          onValueChange={(value) => updateIngredient(index, 'layer', value === 'none' ? '' : value)}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-600 text-white text-sm">
                            <SelectValue placeholder="Слой" />
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
                      
                      {/* Desktop: inline layout */}
                      <div className="hidden sm:flex gap-2 items-start">
                        <Input
                          placeholder="Табак"
                          value={ing.tobacco}
                          onChange={(e) => updateIngredient(index, 'tobacco', e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white flex-1"
                          required
                        />
                        <Input
                          placeholder="Бренд"
                          value={ing.brand}
                          onChange={(e) => updateIngredient(index, 'brand', e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white w-28"
                        />
                        <Input
                          placeholder="%"
                          value={ing.amount}
                          onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                          className="bg-slate-800 border-slate-600 text-white w-16"
                        />
                        <Select
                          value={ing.layer || 'none'}
                          onValueChange={(value) => updateIngredient(index, 'layer', value === 'none' ? '' : value)}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-600 text-white w-32">
                            <SelectValue placeholder="Слой" />
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
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-slate-500">
                  Выберите слой (забивка слоями) или сектор (забивка секторами)
                </p>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-900/50 text-emerald-500 focus:ring-emerald-500 touch-manipulation"
                />
                <Label htmlFor="isPublic" className="text-slate-300 cursor-pointer text-sm">
                  Опубликовать для всех кальянщиков
                </Label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 touch-manipulation"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white touch-manipulation"
                >
                  {editingMix ? 'Сохранить' : 'Создать'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mixes grid - Mobile Optimized */}
      {mixes.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 lg:p-8 text-center">
            <Beaker className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">У вас пока нет миксов</p>
            <p className="text-slate-500 text-sm mt-1">
              Создайте свой первый микс табаков
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {mixes.map((mix) => (
            <Card
              key={mix.id}
              className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors"
            >
              <CardHeader className="pb-2 p-3 lg:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-white text-base lg:text-lg truncate">{mix.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {mix.isPublic && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                          Публичный
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(mix)}
                      className="text-slate-400 hover:text-emerald-500 h-8 w-8 p-0 touch-manipulation"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(mix.id)}
                      className="text-slate-400 hover:text-red-400 h-8 w-8 p-0 touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 lg:p-4 pt-0">
                {mix.description && (
                  <p className="text-slate-400 text-sm mb-3 line-clamp-2">{mix.description}</p>
                )}
                <div className="space-y-1.5">
                  {mix.ingredients.slice(0, 3).map((ing, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs sm:text-sm bg-slate-900/30 p-2 rounded"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-white truncate">{ing.tobacco}</span>
                        {ing.brand && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs border-slate-600 text-slate-400 flex-shrink-0">
                            {ing.brand}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {ing.layer && (
                          <Badge className="bg-purple-500/20 text-purple-400 text-[10px] sm:text-xs hidden sm:flex">
                            <Layers className="w-3 h-3 mr-0.5" />
                            {ing.layer}
                          </Badge>
                        )}
                        {ing.amount && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs border-slate-600">
                            {ing.amount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {mix.ingredients.length > 3 && (
                    <p className="text-xs text-slate-500 text-center">
                      +{mix.ingredients.length - 3} ещё
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-700 text-xs sm:text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    {mix.likes?.length || 0}
                  </span>
                  <span>
                    {new Date(mix.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <div className="fixed bottom-20 right-4 lg:hidden z-30">
        <Button
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/30 touch-manipulation active:scale-95"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
