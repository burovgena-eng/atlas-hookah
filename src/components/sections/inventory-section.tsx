'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Plus,
  Trash2,
  Edit3,
  Leaf,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Calculator,
} from 'lucide-react';
import { ContainerType, TobaccoCategory } from '@/types';

const CATEGORY_INFO: Record<TobaccoCategory, { label: string; description: string; color: string }> = {
  CATEGORY_A: {
    label: 'Категория A',
    description: 'Бестабачные смеси',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  CATEGORY_C: {
    label: 'Категория C',
    description: 'Табачные смеси',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  CATEGORY_D: {
    label: 'Категория D',
    description: 'Смеси на сигарном листе',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
};

// Промежуточный результат по категории
interface CategoryResult {
  category: TobaccoCategory;
  totalWeight: number;
  containersWeight: number;
  netWeight: number;
  containers: { containerTypeId: string; quantity: number }[];
}

export function InventorySection() {
  const { user } = useAuth();
  
  // Все useState должны быть вызваны до любого условного return
  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [activeTab, setActiveTab] = useState('calculator');
  const [loading, setLoading] = useState(true);

  // Промежуточные результаты по категориям
  const [categoryResults, setCategoryResults] = useState<CategoryResult[]>([]);
  
  // Состояние для текущей редактируемой категории
  const [selectedCategory, setSelectedCategory] = useState<TobaccoCategory | ''>('');
  const [totalWeight, setTotalWeight] = useState('');
  const [selectedContainers, setSelectedContainers] = useState<{ containerTypeId: string; quantity: number }[]>([]);
  const [selectedContainerType, setSelectedContainerType] = useState<string>('');

  // Состояние для модального окна контейнера
  const [containerDialogOpen, setContainerDialogOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<ContainerType | null>(null);
  const [containerForm, setContainerForm] = useState({ name: '', weight: '', description: '' });

  // Загрузка контейнеров
  useEffect(() => {
    const controller = new AbortController();
    fetchContainers(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchContainers = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/containers', { signal });
      const data = await response.json();
      if (!signal?.aborted) {
        setContainers(data.containers || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching containers:', error);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  // Расчёт веса контейнеров
  const calculateContainersWeight = () => {
    return selectedContainers.reduce((total, item) => {
      const container = containers.find(c => c.id === item.containerTypeId);
      return total + (container ? container.weight * item.quantity : 0);
    }, 0);
  };

  const currentNetWeight = parseFloat(totalWeight || '0') - calculateContainersWeight();

  // Проверить, есть ли уже результат для категории
  const hasCategoryResult = (category: TobaccoCategory) => {
    return categoryResults.some(r => r.category === category);
  };

  // Получить результат по категории
  const getCategoryResult = (category: TobaccoCategory) => {
    return categoryResults.find(r => r.category === category);
  };

  // Добавить/обновить результат категории
  const addCategoryResult = () => {
    if (!selectedCategory || !totalWeight || parseFloat(totalWeight) <= 0 || currentNetWeight < 0) {
      return;
    }

    const containersWeight = calculateContainersWeight();
    const netWeight = parseFloat(totalWeight) - containersWeight;

    const newResult: CategoryResult = {
      category: selectedCategory,
      totalWeight: parseFloat(totalWeight),
      containersWeight,
      netWeight,
      containers: [...selectedContainers],
    };

    setCategoryResults(prev => {
      const existing = prev.findIndex(r => r.category === selectedCategory);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newResult;
        return updated;
      }
      return [...prev, newResult];
    });

    resetForm();
  };

  // Удалить результат категории
  const removeCategoryResult = (category: TobaccoCategory) => {
    setCategoryResults(prev => prev.filter(r => r.category !== category));
  };

  // Редактировать результат категории
  const editCategoryResult = (category: TobaccoCategory) => {
    const result = getCategoryResult(category);
    if (result) {
      setSelectedCategory(result.category);
      setTotalWeight(result.totalWeight.toString());
      setSelectedContainers(result.containers.map(c => ({ ...c })));
    }
  };

  // Сброс формы
  const resetForm = () => {
    setSelectedCategory('');
    setTotalWeight('');
    setSelectedContainers([]);
    setSelectedContainerType('');
  };

  // Сброс всей инвентаризации
  const resetInventory = () => {
    setCategoryResults([]);
    resetForm();
  };

  // Добавить контейнер в форму
  const addContainerToForm = (containerTypeId: string) => {
    const exists = selectedContainers.some(c => c.containerTypeId === containerTypeId);
    if (!exists) {
      const newContainer = { containerTypeId, quantity: 1 };
      setSelectedContainers(prev => [...prev, newContainer]);
    }
  };

  // Удалить контейнер из формы
  const removeContainerFromForm = (containerTypeId: string) => {
    setSelectedContainers(prev => prev.filter(c => c.containerTypeId !== containerTypeId));
  };

  // Изменить количество контейнера
  const updateContainerQuantity = (containerTypeId: string, quantity: number) => {
    if (quantity <= 0) {
      removeContainerFromForm(containerTypeId);
    } else {
      setSelectedContainers(prev =>
        prev.map(c =>
          c.containerTypeId === containerTypeId ? { ...c, quantity } : c
        )
      );
    }
  };

  // Модальное окно контейнера
  const openContainerDialog = (container?: ContainerType) => {
    if (container) {
      setEditingContainer(container);
      setContainerForm({
        name: container.name,
        weight: container.weight.toString(),
        description: container.description || '',
      });
    } else {
      setEditingContainer(null);
      setContainerForm({ name: '', weight: '', description: '' });
    }
    setContainerDialogOpen(true);
  };

  // Сохранить контейнер
  const saveContainer = async () => {
    if (!containerForm.name || !containerForm.weight) return;

    try {
      const url = '/api/containers';
      const method = editingContainer ? 'PUT' : 'POST';
      const body = editingContainer
        ? { id: editingContainer.id, ...containerForm }
        : containerForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setContainerDialogOpen(false);
        fetchContainers();
      }
    } catch (error) {
      console.error('Error saving container:', error);
    }
  };

  // Удалить контейнер
  const deleteContainer = async (id: string) => {
    if (!confirm('Удалить этот тип контейнера?')) return;

    try {
      const response = await fetch(`/api/containers?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchContainers();
      } else {
        const data = await response.json();
        alert(data.error || 'Ошибка при удалении контейнера');
      }
    } catch (error) {
      console.error('Error deleting container:', error);
      alert('Ошибка при удалении контейнера');
    }
  };

  // Руководителю не показываем калькулятор вообще (после всех хуков!)
  if (user?.role === 'MANAGER') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Калькулятор для мастеров и старших мастеров
  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Калькулятор
          </TabsTrigger>
          <TabsTrigger value="containers" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Контейнеры
          </TabsTrigger>
        </TabsList>

        {/* Вкладка калькулятора */}
        <TabsContent value="calculator" className="space-y-6 mt-6">
          {/* Промежуточные результаты */}
          {categoryResults.length > 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Check className="w-5 h-5 text-emerald-400" />
                    Результаты ({categoryResults.length}/3)
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetInventory}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Сбросить всё
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryResults.map((result) => (
                    <div
                      key={result.category}
                      className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Badge className={CATEGORY_INFO[result.category].color} variant="outline">
                          {CATEGORY_INFO[result.category].label}
                        </Badge>
                        <div className="text-sm">
                          <span className="text-slate-400">Чистый вес: </span>
                          <span className="text-emerald-400 font-bold">{result.netWeight.toFixed(1)} г</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editCategoryResult(result.category)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => removeCategoryResult(result.category)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Общий итог */}
                <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg text-center">
                  <p className="text-slate-400">Общий чистый вес:</p>
                  <p className="text-3xl font-bold text-emerald-400">
                    {categoryResults.reduce((sum, r) => sum + r.netWeight, 0).toFixed(1)} г
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Форма для категории */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Leaf className="w-5 h-5 text-emerald-400" />
                Взвешивание категории
              </CardTitle>
              <CardDescription>
                Взвесьте табак одной категории, укажите контейнеры и добавьте в результат
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Выбор категории */}
              <div className="space-y-2">
                <Label className="text-slate-300">Категория табака</Label>
                <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as TobaccoCategory)}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_INFO).map(([key, info]) => {
                      const hasResult = hasCategoryResult(key as TobaccoCategory);
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Badge className={info.color} variant="outline">
                              {info.label}
                            </Badge>
                            <span className="text-slate-400 text-sm">{info.description}</span>
                            {hasResult && (
                              <Check className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Общий вес */}
              <div className="space-y-2">
                <Label className="text-slate-300">Общий вес (граммы)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={totalWeight}
                  onChange={(e) => setTotalWeight(e.target.value)}
                  placeholder="Введите общий вес табака с контейнерами"
                  className="bg-slate-900/50 border-slate-600 text-white"
                />
              </div>

              {/* Контейнеры */}
              <div className="space-y-3">
                <Label className="text-slate-300">Контейнеры (тара)</Label>
                
                {selectedContainers.length > 0 && (
                  <div className="space-y-2">
                    {selectedContainers.map((item) => {
                      const container = containers.find(c => c.id === item.containerTypeId);
                      if (!container) return null;
                      return (
                        <div
                          key={item.containerTypeId}
                          className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg"
                        >
                          <span className="flex-1 text-white">{container.name}</span>
                          <span className="text-slate-400 text-sm">({container.weight}г)</span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => updateContainerQuantity(item.containerTypeId, item.quantity - 1)}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center text-white">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => updateContainerQuantity(item.containerTypeId, item.quantity + 1)}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-300"
                            onClick={() => removeContainerFromForm(item.containerTypeId)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {containers.length > 0 && (
                  <Select 
                    value={selectedContainerType} 
                    onValueChange={(v) => {
                      addContainerToForm(v);
                      setTimeout(() => setSelectedContainerType(''), 0);
                    }}
                  >
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                      <SelectValue placeholder="Добавить контейнер..." />
                    </SelectTrigger>
                    <SelectContent>
                      {containers
                        .filter(c => !selectedContainers.some(s => s.containerTypeId === c.id))
                        .map((container) => (
                          <SelectItem key={container.id} value={container.id}>
                            {container.name} ({container.weight}г)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                {containers.length === 0 && (
                  <p className="text-slate-400 text-sm">
                    Нет типов контейнеров. Добавьте их на вкладке &quot;Контейнеры&quot;.
                  </p>
                )}
              </div>

              {/* Расчёт для текущей категории */}
              <div className="p-4 bg-slate-700/30 rounded-lg space-y-3">
                <div className="flex justify-between text-slate-300">
                  <span>Общий вес:</span>
                  <span className="font-medium">{parseFloat(totalWeight || '0').toFixed(1)} г</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Вес контейнеров:</span>
                  <span className="font-medium">-{calculateContainersWeight().toFixed(1)} г</span>
                </div>
                <div className="border-t border-slate-600 pt-3 flex justify-between text-white">
                  <span className="font-medium">Чистый вес табака:</span>
                  <span className={`font-bold text-lg ${currentNetWeight < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {currentNetWeight.toFixed(1)} г
                  </span>
                </div>
                {currentNetWeight < 0 && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Вес контейнеров превышает общий вес!
                  </div>
                )}
              </div>

              {/* Кнопка добавления категории */}
              <Button
                onClick={addCategoryResult}
                disabled={!selectedCategory || !totalWeight || parseFloat(totalWeight) <= 0 || currentNetWeight < 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить категорию в результат
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка контейнеров */}
        <TabsContent value="containers" className="space-y-6 mt-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Package className="w-5 h-5 text-slate-400" />
                  Типы контейнеров
                </CardTitle>
                <Button
                  onClick={() => openContainerDialog()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить
                </Button>
              </div>
              <CardDescription>
                Управление типами тары для калькулятора
              </CardDescription>
            </CardHeader>
            <CardContent>
              {containers.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  Нет типов контейнеров. Добавьте первый контейнер.
                </p>
              ) : (
                <div className="space-y-3">
                  {containers.map((container) => (
                    <div
                      key={container.id}
                      className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-white">{container.name}</p>
                        <p className="text-sm text-slate-400">
                          Вес: {container.weight}г
                          {container.description && ` • ${container.description}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openContainerDialog(container)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => deleteContainer(container.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог для редактирования контейнера */}
      <Dialog open={containerDialogOpen} onOpenChange={setContainerDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>
              {editingContainer ? 'Редактировать контейнер' : 'Новый контейнер'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Название</Label>
              <Input
                value={containerForm.name}
                onChange={(e) => setContainerForm({ ...containerForm, name: e.target.value })}
                placeholder="Например: Банка 500мл"
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Вес (граммы)</Label>
              <Input
                type="number"
                step="0.1"
                value={containerForm.weight}
                onChange={(e) => setContainerForm({ ...containerForm, weight: e.target.value })}
                placeholder="Вес контейнера"
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Описание (опционально)</Label>
              <Input
                value={containerForm.description}
                onChange={(e) => setContainerForm({ ...containerForm, description: e.target.value })}
                placeholder="Дополнительная информация"
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setContainerDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Отмена
            </Button>
            <Button
              onClick={saveContainer}
              disabled={!containerForm.name || !containerForm.weight}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {editingContainer ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
}
