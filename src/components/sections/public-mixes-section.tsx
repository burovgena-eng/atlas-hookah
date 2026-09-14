'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Mix } from '@/types';
import { Globe, Heart, MessageCircle, User, Send, X, ArrowUpDown, TrendingUp, Clock, TrendingDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function PublicMixesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMix, setSelectedMix] = useState<Mix | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('default'); // default, popular, new, unpopular

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchMixes = async () => {
      try {
        const response = await fetch(`/api/mixes?userId=${user?.id || ''}&type=public`, {
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

  const toggleLike = async (mixId: string) => {
    if (!user) {
      toast({
        title: 'Ошибка',
        description: 'Необходимо войти в систему',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`/api/mixes/${mixId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (response.ok) {
        setMixes(mixes.map((m) => {
          if (m.id === mixId) {
            const isLiked = data.liked;
            return {
              ...m,
              likes: isLiked
                ? [...(m.likes || []), { userId: user.id }]
                : (m.likes || []).filter((l) => l.userId !== user.id),
            };
          }
          return m;
        }));

        if (selectedMix?.id === mixId) {
          setSelectedMix({
            ...selectedMix,
            likes: data.liked
              ? [...(selectedMix.likes || []), { userId: user.id }]
              : (selectedMix.likes || []).filter((l) => l.userId !== user.id),
          });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const addComment = async () => {
    if (!user || !selectedMix || !commentText.trim()) return;

    try {
      const response = await fetch(`/api/mixes/${selectedMix.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          content: commentText,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSelectedMix({
          ...selectedMix,
          comments: [data.comment, ...(selectedMix.comments || [])],
        });
        setCommentText('');
        toast({
          title: 'Комментарий добавлен',
        });
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const openMixDetail = async (mix: Mix) => {
    try {
      const response = await fetch(`/api/mixes/${mix.id}/comments`);
      const data = await response.json();
      setSelectedMix({
        ...mix,
        comments: data.comments || [],
      });
      setIsDetailOpen(true);
    } catch (error) {
      setSelectedMix(mix);
      setIsDetailOpen(true);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Получить имя автора (или "[Удалён]" если автор удалён)
  const getAuthorName = (mix: Mix) => {
    return mix.author?.name || '[Удалён]';
  };

  const isLiked = (mix: Mix) => {
    return mix.likes?.some((l) => l.userId === user?.id) || false;
  };

  // Сортировка миксов
  const getSortedMixes = (mixesToSort: Mix[]) => {
    const sorted = [...mixesToSort];
    
    switch (sortBy) {
      case 'popular':
        // Самые популярные (больше лайков)
        return sorted.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
      
      case 'unpopular':
        // Менее популярные (меньше лайков)
        return sorted.sort((a, b) => (a.likes?.length || 0) - (b.likes?.length || 0));
      
      case 'new':
        // Новые (по дате создания)
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      case 'old':
        // Старые (по дате создания)
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      default:
        // По умолчанию - как пришло с сервера
        return sorted;
    }
  };

  const sortedMixes = getSortedMixes(mixes);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Публичные миксы</h3>
          <p className="text-slate-400 text-sm">
            Миксы от кальянщиков сети Atlas
          </p>
        </div>
        
        {/* Сортировка */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] h-8 bg-slate-800/50 border-slate-700 text-white text-sm">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="default" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                По умолчанию
              </SelectItem>
              <SelectItem value="popular" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Самые популярные
                </div>
              </SelectItem>
              <SelectItem value="new" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Новые
                </div>
              </SelectItem>
              <SelectItem value="unpopular" className="text-white hover:bg-slate-700 focus:bg-slate-700">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-amber-400" />
                  Менее популярные
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mixes grid */}
      {mixes.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Пока нет публичных миксов</p>
            <p className="text-slate-500 text-sm mt-1">
              Станьте первым, кто поделится своим миксом!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMixes.map((mix) => (
            <Card
              key={mix.id}
              className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer"
              onClick={() => openMixDetail(mix)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600">
                    <AvatarFallback className="text-xs text-white">
                      {getInitials(getAuthorName(mix))}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-white text-base">{mix.name}</CardTitle>
                    <p className="text-slate-400 text-xs">{getAuthorName(mix)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {mix.description && (
                  <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                    {mix.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mb-3">
                  {mix.ingredients.slice(0, 3).map((ing, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-xs border-slate-600 text-slate-300"
                    >
                      {ing.tobacco}
                    </Badge>
                  ))}
                  {mix.ingredients.length > 3 && (
                    <Badge
                      variant="outline"
                      className="text-xs border-slate-600 text-slate-400"
                    >
                      +{mix.ingredients.length - 3}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(mix.id);
                    }}
                    className={`flex items-center gap-1 hover:text-red-400 transition-colors ${
                      isLiked(mix) ? 'text-red-400' : ''
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${isLiked(mix) ? 'fill-red-400' : ''}`}
                    />
                    {mix.likes?.length || 0}
                  </button>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    {mix.comments?.length || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedMix && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedMix.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-green-600">
                    <AvatarFallback className="text-xs text-white">
                      {getInitials(getAuthorName(selectedMix))}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-slate-400 text-sm">
                    {getAuthorName(selectedMix)}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {new Date(selectedMix.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {selectedMix.description && (
                  <p className="text-slate-300">{selectedMix.description}</p>
                )}

                <div>
                  <h4 className="font-medium text-white mb-2">Состав:</h4>
                  <div className="space-y-2">
                    {selectedMix.ingredients.map((ing, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg"
                      >
                        <span className="text-white">{ing.tobacco}</span>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          {ing.brand && <span>{ing.brand}</span>}
                          {ing.amount && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              {ing.amount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-slate-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleLike(selectedMix.id)}
                    className={`border-slate-600 ${
                      isLiked(selectedMix)
                        ? 'text-red-400 border-red-400/50'
                        : 'text-slate-300 hover:text-red-400'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 mr-1 ${
                        isLiked(selectedMix) ? 'fill-red-400' : ''
                      }`}
                    />
                    {selectedMix.likes?.length || 0}
                  </Button>
                </div>

                {/* Comments */}
                <div className="pt-4 border-t border-slate-700">
                  <h4 className="font-medium text-white mb-3">Комментарии</h4>
                  
                  {/* Add comment */}
                  {user && (
                    <div className="flex gap-2 mb-4">
                      <Textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Написать комментарий..."
                        className="bg-slate-900/50 border-slate-600 text-white min-h-[60px]"
                      />
                      <Button
                        onClick={addComment}
                        disabled={!commentText.trim()}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-900"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Comments list */}
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedMix.comments?.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-4">
                        Пока нет комментариев
                      </p>
                    ) : (
                      selectedMix.comments?.map((comment) => (
                        <div
                          key={comment.id}
                          className="p-3 bg-slate-900/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar className="w-5 h-5 bg-gradient-to-br from-slate-500 to-slate-600">
                              <AvatarFallback className="text-xs">
                                {getInitials(comment.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-white">
                              {comment.user.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(comment.createdAt).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
