<script lang="ts">
  interface StatusOption {
    value: string;
    label: string;
    activeClass: string;
  }

  interface Props {
    options: StatusOption[];
    current: string | null;
    disabled?: boolean;
    size?: 'sm' | 'md';
    onselect: (value: string) => void;
  }

  let { options, current, disabled = false, size = 'md', onselect }: Props = $props();

  const sizeClasses = {
    sm: 'rounded border px-2 py-1 text-xs',
    md: 'rounded-lg border px-4 py-2 text-sm font-medium'
  };
</script>

<div class="flex {size === 'sm' ? 'gap-1' : 'gap-2'}">
  {#each options as option}
    <button
      onclick={() => onselect(option.value)}
      {disabled}
      class="{sizeClasses[size]} transition {current === option.value
        ? option.activeClass
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-50"
    >
      {option.label}
    </button>
  {/each}
</div>
