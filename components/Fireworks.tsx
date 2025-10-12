'use client';

import React, { useEffect, useRef } from 'react';

const Fireworks = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 设置画布大小
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // 烟花粒子类
        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            radius: number;
            color: string;
            opacity: number;
            gravity: number;
            friction: number;
            shrink: number;

            constructor(x: number, y: number) {
                this.x = x;
                this.y = y;
                this.vx = Math.random() * 6 - 3;
                this.vy = Math.random() * 6 - 3;
                this.radius = Math.random() * 3 + 1;
                this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
                this.opacity = 1;
                this.gravity = 0.05;
                this.friction = 0.97;
                this.shrink = Math.random() * 0.05 + 0.01;
            }

            update() {
                this.vx *= this.friction;
                this.vy *= this.friction;
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.opacity -= 0.005;
                this.radius -= this.shrink;

                return this.opacity > 0 && this.radius > 0;
            }

            draw() {
                if (!ctx) return;

                ctx.save();
                ctx.globalAlpha = this.opacity;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.restore();
            }
        }

        let particles: Particle[] = [];
        let animationFrameId: number;

        // 创建烟花
        const createFirework = (x: number, y: number) => {
            const particleCount = 100;
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle(x, y));
            }
        };

        // 动画循环
        const animate = () => {
            if (!ctx) return;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 更新和绘制粒子
            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                if (particle.update()) {
                    particle.draw();
                } else {
                    particles.splice(i, 1);
                }
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        // 初始化烟花
        const initFireworks = () => {
            // 创建几轮烟花
            setTimeout(() => createFirework(canvas.width * 0.3, canvas.height * 0.4), 0);
            setTimeout(() => createFirework(canvas.width * 0.7, canvas.height * 0.4), 300);
            setTimeout(() => createFirework(canvas.width * 0.5, canvas.height * 0.2), 600);
            setTimeout(() => createFirework(canvas.width * 0.2, canvas.height * 0.6), 900);
            setTimeout(() => createFirework(canvas.width * 0.8, canvas.height * 0.6), 1200);
        };

        // 开始动画
        animate();
        initFireworks();

        // 清理函数
        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none fixed top-0 left-0 z-50 h-full w-full"
        />
    );
};

export default Fireworks;
