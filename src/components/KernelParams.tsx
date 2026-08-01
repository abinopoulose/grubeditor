import React from 'react';
import { Cpu, Zap, Shield, Gamepad2, MonitorPlay, Info, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { motion } from 'framer-motion';

interface KernelParamsProps {
  config: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export const KernelParams: React.FC<KernelParamsProps> = ({ config, onChange }) => {
  const rawParams = config['GRUB_CMDLINE_LINUX_DEFAULT'] || 'quiet splash';
  const paramList = rawParams.split(' ').filter(Boolean);

  const presets = [
    {
      id: 'quiet splash',
      title: 'Quiet Boot & Graphical Splash Screen',
      desc: 'Suppresses scrolling terminal diagnostics during boot and smoothly reveals your distributor splash artwork.',
      category: 'Experience',
      icon: MonitorPlay,
    },
    {
      id: 'preemption=full',
      title: 'Low-Latency Thread Scheduler',
      desc: 'Instructs the Linux kernel CPU governor to prioritize real-time response times for gaming and studio audio editing.',
      category: 'Performance',
      icon: Gamepad2,
    },
    {
      id: 'mitigations=off',
      title: 'Deactivate Speculative Mitigations',
      desc: 'Disables CPU speculative execution vulnerability defenses (Meltdown/Spectre) for maximum calculation speed.',
      category: 'Overclocking',
      icon: Zap,
    },
    {
      id: 'iommu=pt',
      title: 'IOMMU Hardware Pass-Through',
      desc: 'Optimizes PCI-E bus device isolation for QEMU / KVM virtual machines without disk IO bandwidth degradation.',
      category: 'Virtualization',
      icon: Cpu,
    },
    {
      id: 'nvidia-drm.modeset=1',
      title: 'NVIDIA DRM Direct Modeset',
      desc: 'Mandatory graphics driver kernel flag required for NVIDIA hardware to enable tear-free Wayland compositor frame buffering.',
      category: 'Graphics Drivers',
      icon: Shield,
    },
  ];

  const toggleParam = (paramString: string) => {
    const params = paramString.split(' ');
    const hasAll = params.every((p) => paramList.includes(p));
    let nextList: string[];
    if (hasAll) {
      nextList = paramList.filter((p) => !params.includes(p));
    } else {
      nextList = [...paramList];
      params.forEach((p) => {
        if (!nextList.includes(p)) nextList.push(p);
      });
    }
    onChange('GRUB_CMDLINE_LINUX_DEFAULT', nextList.join(' '));
  };

  return (
    <div className="space-y-16 w-full">
      <div className="space-y-3">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Kernel Tuning & Parameters
        </h2>
        <p className="text-base text-slate-400 max-w-3xl leading-relaxed">
          Inject kernel bootline flags directly into system startup instructions to optimize workstation hardware efficiency and driver compatibility.
        </p>
      </div>

      {/* Active Command Line Box */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle><Cpu className="w-6 h-6 text-indigo-400" /> Active Kernel Command Line</CardTitle>
            <CardDescription>Raw startup parameters appended to the primary Linux kernel binary during boot</CardDescription>
          </div>
          <code className="code-tag shrink-0">GRUB_CMDLINE_LINUX_DEFAULT</code>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <input
              type="text"
              value={rawParams}
              onChange={(e) => onChange('GRUB_CMDLINE_LINUX_DEFAULT', e.target.value)}
              placeholder="e.g. quiet splash iommu=pt"
              className="text-input"
            />
            <div className="flex items-center gap-2.5 text-xs text-slate-400 px-2 font-medium">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Kernel flags are validated and written directly to disk when deploying configuration via Polkit root helper.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hardware Optimization Presets */}
      <section className="space-y-6 section-divider">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <Zap className="w-5 h-5 text-indigo-400" /> Hardware Acceleration Profiles
          </h3>
          <p className="text-sm text-slate-400">Click any profile card to inject or withdraw pre-tested computational optimizations.</p>
        </div>

        <div className="flex flex-col gap-4 pt-2">
          {presets.map((preset) => {
            const Icon = preset.icon;
            const params = preset.id.split(' ');
            const isActive = params.every((p) => paramList.includes(p));

            return (
              <motion.div
                key={preset.id}
                whileHover={{ scale: 1.008 }}
                whileTap={{ scale: 0.995 }}
                onClick={() => toggleParam(preset.id)}
                className={`selection-card !flex-col md:!flex-row md:!items-center !gap-6 ${isActive ? 'active' : ''}`}
              >
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  <div className={`icon-box ${isActive ? 'active' : 'default'}`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-extrabold text-lg text-white">{preset.title}</span>
                      <span className="category-tag">{preset.category}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{preset.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0 md:justify-end">
                  <div className="text-right">
                    <span className="status-label block">Directive Flag</span>
                    <code className={`code-tag block mt-1 ${isActive ? '!bg-indigo-500/20 !text-indigo-200 !border-indigo-500/40' : ''}`}>
                      {preset.id}
                    </code>
                  </div>

                  <div className={`check-indicator ${isActive ? 'active' : 'default'}`}>
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
