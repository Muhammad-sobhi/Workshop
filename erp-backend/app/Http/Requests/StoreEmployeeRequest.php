<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'salary_cycle' => ['required', Rule::in(['day', 'few_days', 'month', 'production'])],
            'rate' => ['required', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
