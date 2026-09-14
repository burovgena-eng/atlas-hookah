'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flame, Eye, EyeOff, Shield, Beaker, UserCog } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function LoginPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'HOOKAH_MASTER' | 'ADMIN' | 'MANAGER'>('HOOKAH_MASTER');

  // Состояния формы входа
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // Состояния формы регистрации
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(loginData.email, loginData.password);

    if (!result.success) {
      toast({
        title: 'Ошибка входа',
        description: result.error,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: 'Ошибка',
        description: 'Пароли не совпадают',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const result = await register(
      registerData.email,
      registerData.password,
      registerData.name,
      registerData.phone,
      selectedRole
    );

    if (!result.success) {
      toast({
        title: 'Ошибка регистрации',
        description: result.error,
        variant: 'destructive',
      });
    } else {
      const responseData = result as { 
        success: boolean; 
        error?: string; 
        isFirstManager?: boolean;
        needsApproval?: boolean;
      };
      
      if (responseData.isFirstManager) {
        toast({
          title: 'Добро пожаловать!',
          description: 'Вы первый руководитель! Аккаунт создан и автоматически подтверждён.',
        });
      } else if (responseData.needsApproval) {
        if (selectedRole === 'MANAGER') {
          toast({
            title: 'Аккаунт создан',
            description: 'Ваш аккаунт создан! Ожидайте подтверждения от существующего руководителя.',
          });
        } else {
          toast({
            title: 'Аккаунт создан',
            description: 'Ваш аккаунт создан! Ожидайте подтверждения от руководителя для входа в систему.',
          });
        }
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25 mb-4">
            <Flame className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Atlas Hookah</h1>
          <p className="text-slate-400 mt-2">Система управления кальянной сетью</p>
        </div>

        {/* Форма */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <Tabs defaultValue="login" className="w-full">
            <CardContent className="pt-6">
              <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 mb-6">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-900"
                >
                  Вход
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-900"
                >
                  Регистрация
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-slate-300">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-slate-300">
                      Пароль
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) =>
                          setLoginData({ ...loginData, password: e.target.value })
                        }
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Входим...' : 'Войти'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Выбор роли */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">Выберите роль</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRole('HOOKAH_MASTER')}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                          selectedRole === 'HOOKAH_MASTER'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                        }`}
                      >
                        <Beaker className={`w-6 h-6 ${
                          selectedRole === 'HOOKAH_MASTER' ? 'text-emerald-500' : 'text-slate-400'
                        }`} />
                        <span className={`text-xs font-medium ${
                          selectedRole === 'HOOKAH_MASTER' ? 'text-emerald-500' : 'text-slate-400'
                        }`}>
                          Кальянный мастер
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole('ADMIN')}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                          selectedRole === 'ADMIN'
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                        }`}
                      >
                        <UserCog className={`w-6 h-6 ${
                          selectedRole === 'ADMIN' ? 'text-amber-500' : 'text-slate-400'
                        }`} />
                        <span className={`text-xs font-medium ${
                          selectedRole === 'ADMIN' ? 'text-amber-500' : 'text-slate-400'
                        }`}>
                          Администратор
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole('MANAGER')}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                          selectedRole === 'MANAGER'
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
                        }`}
                      >
                        <Shield className={`w-6 h-6 ${
                          selectedRole === 'MANAGER' ? 'text-indigo-500' : 'text-slate-400'
                        }`} />
                        <span className={`text-xs font-medium ${
                          selectedRole === 'MANAGER' ? 'text-indigo-500' : 'text-slate-400'
                        }`}>
                          Руководитель
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-slate-300">
                      Имя
                    </Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Иван Иванов"
                      value={registerData.name}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, name: e.target.value })
                      }
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-slate-300">
                      Email
                    </Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your@email.com"
                      value={registerData.email}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, email: e.target.value })
                      }
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-phone" className="text-slate-300">
                      Телефон (необязательно)
                    </Label>
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="+7 (999) 123-45-67"
                      value={registerData.phone}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, phone: e.target.value })
                      }
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-slate-300">
                      Пароль
                    </Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={registerData.password}
                        onChange={(e) =>
                          setRegisterData({ ...registerData, password: e.target.value })
                        }
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm" className="text-slate-300">
                      Подтвердите пароль
                    </Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.confirmPassword}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className={`w-full text-white font-medium ${
                      selectedRole === 'MANAGER'
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700'
                        : selectedRole === 'ADMIN'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                        : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700'
                    }`}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
                  </Button>
                  
                  <p className="text-xs text-slate-400 text-center">
                    ℹ️ Первый руководитель регистрируется автоматически. 
                    Все последующие аккаунты требуют подтверждения.
                  </p>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-6">
          © {new Date().getFullYear()} Atlas Hookah. Все права защищены.
        </p>
      </div>
    </div>
  );
}
