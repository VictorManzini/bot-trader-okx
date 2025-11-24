import { supabase, type Profile } from './client';

export type SignUpData = {
  username: string;
  email: string;
  nome: string;
  sobrenome: string;
  pais_origem: string;
  password: string;
};

export type LoginData = {
  identifier: string; // email ou username
  password: string;
  loginType: 'email' | 'username';
};

export class AuthService {
  /**
   * Registra novo usuário no Supabase Auth e cria perfil
   */
  static async signUp(data: SignUpData) {
    try {
      // 1. Verificar se username já existe
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', data.username)
        .single();

      if (existingUsername) {
        throw new Error('Username já está em uso');
      }

      // 2. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Falha ao criar usuário');

      // 3. Criar perfil na tabela profiles
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: data.username,
        email: data.email,
        nome: data.nome,
        sobrenome: data.sobrenome,
        pais_origem: data.pais_origem,
      });

      if (profileError) {
        // Se falhar ao criar perfil, deletar usuário criado
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      return { user: authData.user, session: authData.session };
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao criar conta');
    }
  }

  /**
   * Login por email + senha
   */
  static async loginWithEmail(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao fazer login');
    }
  }

  /**
   * Login por username + senha
   * Busca o email associado ao username e faz login
   */
  static async loginWithUsername(username: string, password: string) {
    try {
      // 1. Buscar email do username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', username)
        .single();

      if (profileError || !profile) {
        throw new Error('Username não encontrado');
      }

      // 2. Fazer login com email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao fazer login');
    }
  }

  /**
   * Login unificado (email ou username)
   */
  static async login(loginData: LoginData) {
    if (loginData.loginType === 'email') {
      return this.loginWithEmail(loginData.identifier, loginData.password);
    } else {
      return this.loginWithUsername(loginData.identifier, loginData.password);
    }
  }

  /**
   * Logout
   */
  static async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Obter usuário atual
   */
  static async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  /**
   * Obter perfil do usuário atual
   */
  static async getCurrentProfile(): Promise<Profile | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Atualizar perfil (preparado para futura integração OKX)
   */
  static async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
