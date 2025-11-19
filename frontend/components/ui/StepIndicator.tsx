'use client';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
}

const STEPS = [
  { number: 1, label: 'Vision & Brief' },
  { number: 2, label: 'Product Upload' },
  { number: 3, label: 'Mood Selection' },
  { number: 4, label: 'Storyboard' },
  { number: 5, label: 'Video Clips' },
  { number: 6, label: 'Final Video' },
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.number} className="flex-1 flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                  ${
                    step.number === currentStep
                      ? 'bg-blue-500 text-white'
                      : step.number < currentStep
                      ? 'bg-green-500 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }
                `}
              >
                {step.number < currentStep ? '✓' : step.number}
              </div>
              <span
                className={`
                  text-xs mt-2 text-center
                  ${
                    step.number === currentStep
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : step.number < currentStep
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-zinc-500'
                  }
                `}
              >
                {step.label}
              </span>
            </div>

            {/* Connector Line */}
            {index < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 relative top-[-12px]">
                <div
                  className={`
                    h-full
                    ${
                      step.number < currentStep
                        ? 'bg-green-500'
                        : 'bg-zinc-200 dark:bg-zinc-800'
                    }
                  `}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
