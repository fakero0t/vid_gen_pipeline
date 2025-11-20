'use client';

import { ProjectSwitcher } from '@/components/projects/ProjectSwitcher';
import type { StepName } from '@/lib/steps';
import { STEP_ORDER, STEP_LABELS, getStepIndex, isStepBefore } from '@/lib/steps';

interface StepIndicatorProps {
  currentStep: StepName;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentStepIndex = getStepIndex(currentStep);
  
  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      {/* Project Switcher - Centered above step indicators */}
      <div className="flex justify-center mb-6">
        <ProjectSwitcher />
      </div>
      <div className="flex items-center justify-between">
        {STEP_ORDER.map((step, index) => {
          const stepIndex = getStepIndex(step);
          const isCurrent = step === currentStep;
          const isCompleted = isStepBefore(step, currentStep);
          
          return (
            <div key={step} className="flex-1 flex items-center">
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                    ${
                      isCurrent
                        ? 'bg-blue-500 text-white'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                    }
                  `}
                >
                  {isCompleted ? '✓' : stepIndex + 1}
                </div>
                <span
                  className={`
                    text-xs mt-2 text-center
                    ${
                      isCurrent
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-zinc-500'
                    }
                  `}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>

              {/* Connector Line */}
              {index < STEP_ORDER.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 relative top-[-12px]">
                  <div
                    className={`
                      h-full
                      ${isCompleted ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-800'}
                    `}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
