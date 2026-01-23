"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("登录失败: " + error.message);
    } else {
      router.refresh();
      router.push("/dashboard"); // 登录成功跳转
    }
  };

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // 关键！指定验证完跳回哪里
        // location.origin 在浏览器里就是你的域名 https://abc.com
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) alert(error.message);
    else alert("注册成功，请去邮箱验证！");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">后台管理登录</h1>
      <input
        className="border p-2 rounded text-black"
        placeholder="邮箱"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="border p-2 rounded text-black"
        type="password"
        placeholder="密码"
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex gap-4">
        <button
          onClick={handleLogin}
          className="bg-blue-500 text-white p-2 rounded"
        >
          登录
        </button>
        <button
          onClick={handleSignUp}
          className="bg-green-500 text-white p-2 rounded"
        >
          注册
        </button>
      </div>
    </div>
  );
}
