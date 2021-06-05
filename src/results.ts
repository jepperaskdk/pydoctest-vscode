export enum ResultType {
    NOT_RUN = 0,
    OK = 1,
    FAILED = 2,
    SKIPPED = 3,
    NO_DOC = 4
}

export class Result {
    result: ResultType = ResultType.NOT_RUN;
    fail_reason: string = "";
}

export class FunctionValidationResult extends Result {
    function: string = "";
}

export class ClassValidationResult extends Result {
    class_name: string = "";
    function_results: FunctionValidationResult[] = [];
}

export class ModuleValidationResult extends Result {
    module_path: string = "";
    function_results: FunctionValidationResult[] = [];
    class_results: ClassValidationResult[] = [];
}

export class ValidationResult extends Result {
    module_results: ModuleValidationResult[] = [];
}
