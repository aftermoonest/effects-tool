import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';

const meta = {
    title: 'UI/Input',
    component: Input,
    tags: ['autodocs'],
    argTypes: {
        type: {
            control: 'select',
            options: ['text', 'password', 'email', 'number', 'search'],
        },
        disabled: { control: 'boolean' },
        placeholder: { control: 'text' },
    },
    decorators: [
        (Story) => (
            <div className="w-72">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof Input>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { placeholder: 'Enter value...' },
};

export const WithValue: Story = {
    args: { defaultValue: '1920' },
};

export const Password: Story = {
    args: { type: 'password', placeholder: 'Password' },
};

export const Disabled: Story = {
    args: { placeholder: 'Disabled', disabled: true },
};

export const Email: Story = {
    args: { type: 'email', placeholder: 'name@example.com' },
};

export const AllStates: Story = {
    render: () => (
        <div className="flex flex-col gap-3 w-72">
            <Input placeholder="Default" />
            <Input defaultValue="With value" />
            <Input placeholder="Disabled" disabled />
            <Input type="password" placeholder="Password" />
        </div>
    ),
};
