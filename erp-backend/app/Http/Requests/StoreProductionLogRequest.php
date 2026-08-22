<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductionLogRequest extends FormRequest
{
    public function authorize()
    {
        return true; // Authorised by middleware
    }

    public function rules()
    {
        return [
            'work_date' => 'required|date',
            'product_id' => 'nullable|exists:products,id',
            'operation_id' => 'nullable|exists:operations,id',
            'labor_service_id' => 'nullable', // if you have labor services
            'quantity' => 'required|numeric|min:0.01',
            'piece_rate' => 'nullable|numeric|min:0',
            'deductions' => 'nullable|numeric|min:0',
            'deduction_reason' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ];
    }
}
